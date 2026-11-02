import type { Role } from '@prisma/client'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createError, deleteCookie, getCookie, getRequestHeader, setCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { actorOf, log, setLogActor } from './logger'
import prisma from './prisma'

/**
 * Single source of truth for authentication on the server.
 *
 * Every protected route calls `requireAuth(event)` (any signed-in user)
 * or `requireRole(event, ...)` / `requireAdmin(event)` (privileged).
 * Guards are applied per-route on purpose — a global Nitro middleware
 * would run JWT verification on every request, including the ~40 static
 * template demo endpoints and page SSR, and an accidental gap there is
 * harder to spot than an explicit guard at the top of each handler.
 *
 * The one exception is `middleware/02.session.ts`, and it only ever takes
 * access away: it marks a token whose session was signed out as revoked, so
 * these guards see no session. It never lets a request in.
 *
 * Two kinds of session (ADR-025). A **customer** session comes from the
 * panel's sign-in and lives seven days in `auth_token`. A **staff** session
 * comes only from the admin console's sign-in (`/api/admin/auth/*`), which
 * requires two-step verification; it lives in `apex_admin` (SameSite=Strict)
 * for at most twelve hours and ends after two idle hours. `requireAdmin`
 * accepts nothing else, so a password alone never reaches the admin API, and
 * the customer sign-in refuses staff accounts. A browser holds one or the
 * other: starting either kind clears the other cookie.
 */

export type SessionKind = 'customer' | 'staff'

/**
 * Verified JWT payload — what `jwt.sign` receives at login/signup.
 * `id` is the identity and `role` drives authorization; `email` is
 * informational and null for accounts that registered with a phone only.
 */
export interface AuthSession {
  id: string
  email: string | null
  role: Role
  /** The `Session` row this token belongs to; null for a token issued before sessions were recorded. */
  sid: string | null
  /** Which sign-in made it. Tokens from before ADR-025 carry none and are customer sessions. */
  kind: SessionKind
}

/** A verified token's claims, before the session check in `middleware/02.session.ts`. */
export interface AuthTokenClaims extends AuthSession {
  /** Issued-at, in seconds. */
  iat: number
}

const AUTH_COOKIE = 'auth_token'
const STAFF_COOKIE = 'apex_admin'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days, matches cookie maxAge
/** A staff session's absolute life; the idle limit is in `middleware/02.session.ts`. */
export const STAFF_TOKEN_TTL_SECONDS = 60 * 60 * 12
/** A staff session unused for this long is ended on its next request. */
export const STAFF_IDLE_MS = 2 * 60 * 60_000

function ttlFor(kind: SessionKind): number {
  return kind === 'staff' ? STAFF_TOKEN_TTL_SECONDS : TOKEN_TTL_SECONDS
}

let warnedWeakSecret = false

function jwtSecret(event: H3Event): string {
  const secret = useRuntimeConfig(event).jwtSecret || 'secret'
  if (secret === 'secret' && !import.meta.dev && !warnedWeakSecret) {
    log('security').error('security.jwt.fallback-secret', 'Production is running on the fallback JWT secret; set NUXT_JWT_SECRET')
    warnedWeakSecret = true
  }
  return secret
}

/**
 * Decode and verify the session cookie. Returns `null` on any failure
 * (missing cookie, bad signature, expired, malformed payload) — never
 * throws, so an invalid token can't surface as a 500.
 *
 * The staff cookie is read first, and only a token that says it is a staff
 * session counts there; a customer token copied into it is ignored.
 */
export function readAuthToken(event: H3Event): AuthTokenClaims | null {
  const staff = verifyToken(event, getCookie(event, STAFF_COOKIE))
  if (staff?.kind === 'staff') {
    return staff
  }
  const customer = verifyToken(event, getCookie(event, AUTH_COOKIE))
  return customer?.kind === 'customer' ? customer : null
}

function verifyToken(event: H3Event, token: string | undefined): AuthTokenClaims | null {
  if (!token) {
    return null
  }
  try {
    const decoded = jwt.verify(token, jwtSecret(event))
    if (typeof decoded !== 'object' || decoded === null) {
      return null
    }
    const { id, email, role, sid, iat, purpose, kind } = decoded as Record<string, unknown>
    // A two-step ticket is signed with the same secret; it is never a session.
    if (typeof id !== 'string' || typeof role !== 'string' || purpose !== undefined) {
      return null
    }
    return {
      id,
      email: typeof email === 'string' ? email : null,
      role: role as Role,
      sid: typeof sid === 'string' ? sid : null,
      kind: kind === 'staff' ? 'staff' : 'customer',
      iat: typeof iat === 'number' ? iat : 0,
    }
  }
  catch {
    return null
  }
}

/**
 * The signed-in session, or null. Also null when the token is valid but its
 * session was signed out from Settings, expired or predates a "sign out
 * everywhere": the session middleware decides that once per request and
 * leaves `authRevoked` on the context, which keeps this function synchronous.
 */
export function getAuthSession(event: H3Event): AuthSession | null {
  if (event.context.authRevoked) {
    return null
  }
  const claims = readAuthToken(event)
  if (!claims) {
    return null
  }
  const { iat: _iat, ...session } = claims
  return session
}

/** Session or a clean 401. The fast path for customer routes (JWT-only, no DB hit). */
export function requireAuth(event: H3Event): AuthSession {
  const session = getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Authentication required' })
  }
  setLogActor(event, actorOf(session))
  return session
}

/**
 * Session with a DB-fresh role check — 403 unless the user's *current*
 * role is in `roles`. Deliberately not trusting the JWT role claim:
 * tokens live 7 days and a demoted admin must lose access immediately.
 */
export async function requireRole(event: H3Event, ...roles: Role[]): Promise<AuthSession> {
  const session = requireAuth(event)
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { role: true, status: true },
  })
  if (!user) {
    // Token is valid but the account no longer exists.
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Authentication required' })
  }
  /*
   * Suspension has to end a live session, not just block the next sign-in
   * (Phase 9 Admin). Login already refuses a suspended account, but tokens
   * last seven days and nothing here re-checked, so withdrawing a
   * colleague's access left them working in the panel until their cookie
   * happened to expire — which is not what "Suspend" says it does. Read
   * fresh from the database for the same reason the role is: the JWT
   * states what was true when it was issued.
   */
  if (user.status === 'SUSPENDED') {
    log('authz').warn('authz.suspended', 'A suspended account was refused', { outcome: 'denied' })
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'This account has been suspended.' })
  }
  if (!roles.includes(user.role)) {
    log('authz').warn('authz.role-denied', `Role ${user.role} is not one of ${roles.join(', ')}`, { outcome: 'denied', data: { role: user.role, required: roles } })
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Insufficient permissions' })
  }
  return { ...session, role: user.role }
}

/**
 * The admin API's gate: an ADMIN account on a staff session. An admin
 * holding an older customer session gets a 401 rather than a 403, because
 * the remedy is to sign in through the staff sign-in, not to ask for a role.
 */
export async function requireAdmin(event: H3Event): Promise<AuthSession> {
  const session = await requireRole(event, 'ADMIN')
  if (session.kind !== 'staff') {
    log('authz').warn('authz.staff-session-required', 'An admin account used a customer session on the admin API', { outcome: 'denied' })
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Sign in through the staff sign-in to use the admin console.', data: { signIn: '/admin/sign-in' } })
  }
  return session
}

/**
 * Sign someone in on this browser: record a `Session` (what Settings lists as
 * a signed-in device), sign a token naming it and set the cookie. Every
 * sign-in path — password, two-step code, signup, staff sign-in — goes
 * through here; only `/api/admin/auth/*` passes `kind: 'staff'`.
 */
export async function startSession(event: H3Event, user: { id: string, email: string | null, role: Role }, kind: SessionKind = 'customer'): Promise<string> {
  const ttl = ttlFor(kind)
  const row = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 400) ?? null,
      expiresAt: new Date(Date.now() + ttl * 1000),
      kind,
    },
    select: { id: true },
  })
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, sid: row.id, kind },
    jwtSecret(event),
    { expiresIn: ttl },
  )
  setAuthCookie(event, token, kind)
  const actor = actorOf({ id: user.id, role: user.role, kind })
  setLogActor(event, actor)
  log('auth').info('auth.session.started', `${kind === 'staff' ? 'Staff' : 'Customer'} session started`, { outcome: 'success', actor, data: { sessionId: row.id, kind, ttlSeconds: ttl } })
  return row.id
}

/** Sign out this browser: end its session row, then clear the cookie. */
export async function endSession(event: H3Event): Promise<void> {
  const claims = readAuthToken(event)
  if (claims?.sid) {
    await prisma.session.updateMany({ where: { id: claims.sid, revokedAt: null }, data: { revokedAt: new Date() } })
  }
  clearAuthCookie(event)
  log('auth').info('auth.session.ended', claims ? 'Signed out' : 'Sign-out without a session', { outcome: claims ? 'success' : 'skipped', ...(claims ? { actor: actorOf(claims) } : {}), data: { sessionId: claims?.sid ?? null } })
}

/**
 * Sign an account out everywhere except, optionally, one session: revoke the
 * rows and stamp `sessionsValidAfter`, which also ends tokens issued before
 * sessions were recorded (they have no row to revoke).
 */
export async function endOtherSessions(userId: string, keepSid: string | null): Promise<number> {
  const now = new Date()
  const [revoked] = await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(keepSid ? { id: { not: keepSid } } : {}) },
      data: { revokedAt: now },
    }),
    prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: now } }),
  ])
  return revoked.count
}

const TICKET_TTL_SECONDS = 5 * 60

/**
 * A short-lived token for one job that is not a session: the two-step
 * sign-in ticket, a website preview link (ADR-021). Every one carries a
 * `purpose`, which is what `readAuthToken` refuses, so none of them can be
 * presented as a session cookie no matter what else it claims.
 */
export function signPurposeToken(event: H3Event, purpose: string, claims: Record<string, unknown>, ttlSeconds: number): string {
  return jwt.sign({ ...claims, purpose }, jwtSecret(event), { expiresIn: ttlSeconds })
}

/** The claims of a purpose token, or null when it is invalid, expired or for another purpose. */
export function readPurposeToken(event: H3Event, token: string, purpose: string): Record<string, unknown> | null {
  try {
    const decoded = jwt.verify(token, jwtSecret(event))
    if (typeof decoded !== 'object' || decoded === null || (decoded as Record<string, unknown>).purpose !== purpose) {
      return null
    }
    return decoded as Record<string, unknown>
  }
  catch {
    return null
  }
}

/**
 * The proof that a password was right, handed back when the account also needs
 * a two-step code. Five minutes, names nothing but the account.
 */
export function signTwoFactorTicket(event: H3Event, userId: string): string {
  return signPurposeToken(event, 'two-factor', { uid: userId }, TICKET_TTL_SECONDS)
}

export function readTwoFactorTicket(event: H3Event, ticket: string): string | null {
  const claims = readPurposeToken(event, ticket, 'two-factor')
  return claims && typeof claims.uid === 'string' ? claims.uid : null
}

/**
 * One place for cookie attributes so login/signup/logout can't drift.
 *
 * The staff cookie is SameSite=Strict: no other site can make a browser
 * send it, at the cost that following a link to /admin from an email lands
 * on the staff sign-in, which then finds the session and carries on.
 *
 * `httpOnly: true` — the token is unreadable from JavaScript, so an XSS
 * payload cannot exfiltrate a session. This required reworking the client
 * route guards (app/middleware/{auth,admin}.ts), which previously read the
 * cookie via `useCookie` as a fast path; they now rely on `fetchUser()`,
 * whose answer is server-verified anyway. The old fast path was never a
 * security control — a forged cookie value passed it just as easily.
 */
export function setAuthCookie(event: H3Event, token: string, kind: SessionKind = 'customer'): void {
  setCookie(event, kind === 'staff' ? STAFF_COOKIE : AUTH_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: kind === 'staff' ? 'strict' : 'lax',
    maxAge: ttlFor(kind),
    path: '/',
  })
  deleteCookie(event, kind === 'staff' ? AUTH_COOKIE : STAFF_COOKIE, { path: '/' })
}

/** Clear both session cookies: a sign-out ends whichever this browser holds. */
export function clearAuthCookie(event: H3Event): void {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
  deleteCookie(event, STAFF_COOKIE, { path: '/' })
}
