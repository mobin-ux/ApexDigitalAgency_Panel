import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../utils/audit'
import { issueAuthToken, setAuthCookie } from '../../utils/auth'
import { identifierWhere, parseIdentifier } from '../../utils/identifier'
import prisma from '../../utils/prisma'
import { clientIp, rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/login — verify credentials, set the session cookie.
 *
 * The identifier is either an email address or a mobile phone number (the same
 * one used at signup — see utils/identifier). The 401 message is identical for
 * "unknown account" and "wrong password" so the endpoint can't be used to
 * enumerate accounts. The JWT lives only in the cookie — never in the body.
 */

const bodySchema = z.object({
  // `identifier` is the new field; `email` is accepted for older callers.
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1),
}).refine(data => Boolean(data.identifier || data.email), {
  message: 'An email address or phone number is required',
  path: ['identifier'],
})

export default defineEventHandler(async (event) => {
  // Per-IP budget first: this must apply even to malformed bodies, or the
  // validation step becomes a free oracle for hammering the endpoint.
  rateLimit(event, RateLimits.login)

  const body = await validateBody(event, bodySchema)
  const rawIdentifier = body.identifier ?? body.email ?? ''
  const parsed = parseIdentifier(rawIdentifier)

  // Second budget keyed on the identifier being tried, so distributing an
  // attack across many IPs still cannot brute-force a single account.
  rateLimit(event, { ...RateLimits.login, bucket: 'auth:login:id', identity: rawIdentifier.toLowerCase() })

  // A malformed identifier can't match any account — answer with the uniform
  // 401 rather than a distinct error, so it isn't a validity oracle.
  const user = parsed ? await prisma.user.findUnique({ where: identifierWhere(parsed) }) : null
  const passwordValid = user ? await bcrypt.compare(body.password, user.password) : false
  if (!user || !passwordValid) {
    // Failed attempts are an audit trail: this is the signal that shows a
    // credential-stuffing run in progress.
    await recordAudit(event, { id: user?.id ?? 'anonymous', email: user?.email ?? rawIdentifier }, {
      action: 'auth.login.failed',
      targetType: 'User',
      targetId: user?.id,
      metadata: { reason: user ? 'bad_password' : 'unknown_account', ip: clientIp(event) },
    })
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  // Suspension check only after the password is verified, so this error
  // can't be used to probe which identifiers have accounts.
  if (user.status === 'SUSPENDED') {
    throw createError({ statusCode: 403, message: 'This account has been suspended. Contact support for assistance.' })
  }

  const token = issueAuthToken(event, user)
  setAuthCookie(event, token)

  const { password: _password, ...userWithoutPassword } = user
  return { status: 'success', user: userWithoutPassword }
})
