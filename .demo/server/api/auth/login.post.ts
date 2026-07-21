import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../utils/audit'
import { issueAuthToken, setAuthCookie } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { clientIp, rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/login — verify credentials, set the session cookie.
 * The 401 message is identical for "unknown email" and "wrong password"
 * so the endpoint can't be used to enumerate accounts. The JWT lives
 * only in the cookie — it is never returned in the response body.
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  // Per-IP budget first: this must apply even to malformed bodies, or the
  // validation step becomes a free oracle for hammering the endpoint.
  rateLimit(event, RateLimits.login)

  const { email, password } = await validateBody(event, bodySchema)

  // Second budget keyed on the email being tried, so distributing an attack
  // across many IPs still cannot brute-force a single account.
  rateLimit(event, { ...RateLimits.login, bucket: 'auth:login:email', identity: email })

  const user = await prisma.user.findUnique({ where: { email } })
  const passwordValid = user ? await bcrypt.compare(password, user.password) : false
  if (!user || !passwordValid) {
    // Failed attempts are an audit trail: this is the signal that shows a
    // credential-stuffing run in progress.
    await recordAudit(event, { id: user?.id ?? 'anonymous', email }, {
      action: 'auth.login.failed',
      targetType: 'User',
      targetId: user?.id,
      metadata: { reason: user ? 'bad_password' : 'unknown_email', ip: clientIp(event) },
    })
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  // Suspension check only after the password is verified, so this error
  // can't be used to probe which emails have accounts.
  if (user.status === 'SUSPENDED') {
    throw createError({ statusCode: 403, message: 'This account has been suspended. Contact support for assistance.' })
  }

  const token = issueAuthToken(event, user)
  setAuthCookie(event, token)

  const { password: _password, ...userWithoutPassword } = user
  return { status: 'success', user: userWithoutPassword }
})
