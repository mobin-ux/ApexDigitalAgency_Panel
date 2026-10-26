import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../utils/audit'
import { readTwoFactorTicket, startSession } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { clientIp, rateLimit, RateLimits } from '../../utils/ratelimit'
import { verifySecondFactor } from '../../utils/two-factor'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/login-2fa — the second step of signing in: the ticket from
 * `/api/auth/login` plus a code from the authenticator app or a backup code.
 * Rate-limited per IP and per account like the password step, so six digits
 * cannot be walked through.
 */
const bodySchema = z.object({
  ticket: z.string().min(1),
  code: z.string().trim().min(6).max(12),
}).strict()

export default defineEventHandler(async (event) => {
  // Its own per-IP budget, so password typos do not use up the code step.
  rateLimit(event, { ...RateLimits.login, bucket: 'auth:login-2fa' })
  const { ticket, code } = await validateBody(event, bodySchema)
  const userId = readTwoFactorTicket(event, ticket)
  if (!userId) {
    throw createError({ statusCode: 401, message: 'That sign-in took too long. Enter your password again.' })
  }
  rateLimit(event, { ...RateLimits.login, bucket: 'auth:login:2fa', identity: userId })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.status === 'SUSPENDED') {
    throw createError({ statusCode: 401, message: 'That sign-in took too long. Enter your password again.' })
  }
  const via = await verifySecondFactor(user.id, code, { backup: true })
  if (!via) {
    await recordAudit(event, { id: user.id, email: user.email ?? user.id }, {
      action: 'auth.login.failed',
      targetType: 'User',
      targetId: user.id,
      metadata: { reason: 'bad_two_factor_code', ip: clientIp(event) },
    })
    throw createError({ statusCode: 400, message: 'That code did not work. Use the newest code from your app, or a backup code.' })
  }

  await startSession(event, user)
  const { password: _password, sessionsValidAfter: _sva, ...userWithoutPassword } = user
  return { status: 'success', via, user: userWithoutPassword }
})
