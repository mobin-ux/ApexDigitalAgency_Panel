import type { DeliveryOutcome } from '../../../utils/mail/outbox'
import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { queueVerificationMail } from '../../../utils/mail/flows'
import { deliverNow } from '../../../utils/mail/outbox'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'

/**
 * POST /api/auth/verify-email/request — send (again) the link that
 * confirms the signed-in account's email address. Takes no body. A phone-
 * only account has nothing to verify by email (400); an address already
 * confirmed is a no-op (200, `verified: true`).
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.verifyEmail, identity: session.id })

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, email: true, firstName: true, verifiedAt: true } })
  if (!user?.email) {
    throw createError({ statusCode: 400, message: 'This account has no email address to confirm.' })
  }
  if (user.verifiedAt) {
    return { status: 'success', verified: true, mail: null as DeliveryOutcome | null }
  }

  const { id } = await queueVerificationMail(event, { id: user.id, email: user.email, firstName: user.firstName })
  const [outcome] = await deliverNow([id])
  const mail: DeliveryOutcome | null = outcome ?? { id, status: 'QUEUED', error: null }
  return { status: 'success', verified: false, mail }
})
