import type { User } from '@prisma/client'
import type { H3Event } from 'h3'
import bcrypt from 'bcryptjs'
import { createError } from 'h3'
import { recordAudit } from './audit'
import { readPurposeToken, signPurposeToken } from './auth'
import { identifierWhere, parseIdentifier } from './identifier'
import prisma from './prisma'
import { clientIp, rateLimit, RateLimits } from './ratelimit'

/**
 * The admin console's own sign-in (ADR-025), separate from the customer one:
 *
 *   password  → POST /api/admin/auth/login
 *     two-step on   → { status: 'two_factor', ticket }  → POST …/login-2fa
 *     two-step off  → { status: 'enrol', ticket }       → POST …/enrol/start, …/enrol/finish
 *
 * Only a staff session (`kind: 'staff'`) comes out of it, and only after a
 * code from an authenticator app: a staff account without two-step is made
 * to set it up before it gets one. The tickets are purpose tokens, so none
 * of them can be presented as a session.
 *
 * Every refusal before the password is proved is the same 401, whether the
 * address is unknown, the password wrong or the account a customer's, so
 * the form cannot be used to find out who works here.
 */

const CODE_TICKET = 'staff-two-factor'
const ENROL_TICKET = 'staff-enrol'
const CODE_TICKET_TTL = 5 * 60
const ENROL_TICKET_TTL = 15 * 60

const INVALID = 'Invalid email or password'
const EXPIRED = 'That sign-in took too long. Enter your password again.'

/** Check a staff password, under both budgets of the staff sign-in limiter. */
export async function checkStaffPassword(event: H3Event, rawEmail: string, password: string): Promise<User> {
  rateLimit(event, RateLimits.staffLogin)
  const email = rawEmail.trim().toLowerCase()
  rateLimit(event, { ...RateLimits.staffLogin, bucket: 'auth:staff:id', identity: email })

  const parsed = parseIdentifier(email)
  const user = parsed?.kind === 'email' ? await prisma.user.findUnique({ where: identifierWhere(parsed) }) : null
  const passwordValid = user ? await bcrypt.compare(password, user.password) : false
  if (!user || !passwordValid || user.role !== 'ADMIN') {
    await recordAudit(event, { id: user?.id ?? 'anonymous', email: user?.email ?? email }, {
      action: 'auth.staff.login.failed',
      targetType: 'User',
      targetId: user?.id,
      metadata: { reason: !user ? 'unknown_account' : !passwordValid ? 'bad_password' : 'not_staff', ip: clientIp(event) },
    })
    throw createError({ statusCode: 401, message: INVALID })
  }
  if (user.status === 'SUSPENDED') {
    throw createError({ statusCode: 403, message: 'This account has been suspended. Ask an owner to restore it.' })
  }
  return user
}

export function signStaffCodeTicket(event: H3Event, userId: string): string {
  return signPurposeToken(event, CODE_TICKET, { uid: userId }, CODE_TICKET_TTL)
}

export function signStaffEnrolTicket(event: H3Event, userId: string): string {
  return signPurposeToken(event, ENROL_TICKET, { uid: userId }, ENROL_TICKET_TTL)
}

/**
 * The staff account a ticket names, re-read: still staff, still active. A
 * ticket outlives nothing it vouched for, so a suspension or demotion in the
 * minutes between the password and the code still stops the sign-in.
 */
export async function staffFromTicket(event: H3Event, ticket: string, kind: 'code' | 'enrol'): Promise<User> {
  const claims = readPurposeToken(event, ticket, kind === 'code' ? CODE_TICKET : ENROL_TICKET)
  const uid = typeof claims?.uid === 'string' ? claims.uid : null
  const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null
  if (!user || user.role !== 'ADMIN' || user.status === 'SUSPENDED') {
    throw createError({ statusCode: 401, message: EXPIRED })
  }
  // The code step has its own budget per account, so six digits cannot be walked through.
  rateLimit(event, { ...RateLimits.staffLogin, bucket: `auth:staff:${kind}`, identity: user.id })
  return user
}

/** What a sign-in answer carries about the account: never the hash or session bookkeeping. */
export function publicStaff(user: User) {
  const { password: _password, sessionsValidAfter: _sva, ...rest } = user
  return rest
}
