import type { Role } from '@prisma/client'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createError, deleteCookie, getCookie, setCookie } from 'h3'
import jwt from 'jsonwebtoken'
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
 */

/** Verified JWT payload — what `jwt.sign` receives at login/signup. */
export interface AuthSession {
  id: string
  email: string
  role: Role
}

const AUTH_COOKIE = 'auth_token'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days, matches cookie maxAge

let warnedWeakSecret = false

function jwtSecret(event: H3Event): string {
  const secret = useRuntimeConfig(event).jwtSecret || 'secret'
  if (secret === 'secret' && !import.meta.dev && !warnedWeakSecret) {
    console.warn('[auth] SECURITY: production is running on the fallback JWT secret — set NUXT_JWT_SECRET')
    warnedWeakSecret = true
  }
  return secret
}

/**
 * Decode and verify the auth cookie. Returns `null` on any failure
 * (missing cookie, bad signature, expired, malformed payload) — never
 * throws, so an invalid token can't surface as a 500.
 */
export function getAuthSession(event: H3Event): AuthSession | null {
  const token = getCookie(event, AUTH_COOKIE)
  if (!token) {
    return null
  }
  try {
    const decoded = jwt.verify(token, jwtSecret(event))
    if (typeof decoded !== 'object' || decoded === null) {
      return null
    }
    const { id, email, role } = decoded as Record<string, unknown>
    if (typeof id !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      return null
    }
    return { id, email, role: role as Role }
  }
  catch {
    return null
  }
}

/** Session or a clean 401. The fast path for customer routes (JWT-only, no DB hit). */
export function requireAuth(event: H3Event): AuthSession {
  const session = getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Authentication required' })
  }
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
    select: { role: true },
  })
  if (!user) {
    // Token is valid but the account no longer exists.
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Authentication required' })
  }
  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Insufficient permissions' })
  }
  return { ...session, role: user.role }
}

/** Shorthand for the common case. */
export function requireAdmin(event: H3Event): Promise<AuthSession> {
  return requireRole(event, 'ADMIN')
}

/** Sign a session token. Payload shape must stay in sync with AuthSession. */
export function issueAuthToken(event: H3Event, user: { id: string, email: string, role: Role }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtSecret(event),
    { expiresIn: TOKEN_TTL_SECONDS },
  )
}

/**
 * One place for cookie attributes so login/signup/logout can't drift.
 * `httpOnly` stays false for now: the client route middleware
 * (app/middleware/auth.ts) reads the cookie via `useCookie` as its
 * fast-path check and would break on client-side navigation. Flipping
 * it (and reworking that middleware to rely on fetchUser alone) is a
 * tracked production-hardening follow-up.
 */
export function setAuthCookie(event: H3Event, token: string): void {
  setCookie(event, AUTH_COOKIE, token, {
    httpOnly: false,
    secure: !import.meta.dev,
    sameSite: 'lax',
    maxAge: TOKEN_TTL_SECONDS,
    path: '/',
  })
}

export function clearAuthCookie(event: H3Event): void {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
}
