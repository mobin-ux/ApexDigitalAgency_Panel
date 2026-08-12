import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { settleIntent } from '../../../payments/service'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/topup/confirm — complete an interactive top-up that needed
 * a verification step (simulated 3-D Secure on the sandbox rail).
 *
 * A card charge for an amount that triggers the mock rail's `requires_action`
 * outcome lands the intent in `requires_action`; this endpoint stands in for
 * the customer completing the bank challenge and settles it. In live mode this
 * step happens client-side (Stripe.js) and the wallet moves on the webhook — so
 * confirming here is a no-op safety net (settleIntent is idempotent).
 *
 * Ownership-checked: a customer can only confirm their own intent.
 */

const bodySchema = z.object({
  reference: z.string().trim().min(4).max(60),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { reference } = await validateBody(event, bodySchema)

  const intent = await prisma.paymentIntent.findFirst({
    where: { reference, userId: session.id, purpose: 'wallet_topup' },
  })
  if (!intent) {
    throw createError({ statusCode: 404, message: 'Payment not found.' })
  }

  if (intent.status === 'succeeded') {
    // Already done — idempotent.
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { walletBalance: true } })
    return { status: 'succeeded', settled: false, walletBalance: user?.walletBalance ?? 0 }
  }
  if (intent.status === 'failed' || intent.status === 'cancelled') {
    throw createError({ statusCode: 409, message: 'This payment can no longer be verified. Please try again.' })
  }

  const settled = await settleIntent(intent.id, { feeAmount: intent.feeAmount })
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { walletBalance: true } })

  return { status: 'succeeded', settled, walletBalance: user?.walletBalance ?? 0 }
})
