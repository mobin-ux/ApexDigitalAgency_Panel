import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { randomToken } from '../../utils/crypto'
import { queuePasswordResetMail, RESET_LINK_TTL_MINUTES } from '../../utils/mail/flows'
import { deliverNow } from '../../utils/mail/outbox'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/reset-password-request — start the reset flow.
 * Always answers success so the endpoint can't be used to probe which
 * emails have accounts.
 *
 * The link goes out through the mail outbox (ADR-022): queued with the
 * account, tried at once, retried by the scheduler. The token is never
 * logged. With no mail provider configured the row is recorded as failed
 * and the recover page, reading `features.mail`, does not offer this form.
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

const RESPONSE = { status: 'success', message: 'If the email exists, a link has been sent.' }

export default defineEventHandler(async (event) => {
  // Reset mail is expensive and abusable as a harassment vector.
  rateLimit(event, RateLimits.passwordReset)

  const { email } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
  if (!user?.email) {
    return RESPONSE
  }

  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + RESET_LINK_TTL_MINUTES * 60 * 1000)

  const { id } = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.create({ data: { email, token, expiresAt, userId: user.id } })
    return queuePasswordResetMail({ id: user.id, email: user.email! }, token, tx)
  })
  // The person is told to check their inbox either way; the outbox and the
  // scheduler own what happens next, and the Email screen shows it.
  void deliverNow([id])

  return RESPONSE
})
