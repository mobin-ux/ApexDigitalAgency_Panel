import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { startPayment } from '../../payments/service'
import { requireAuth } from '../../utils/auth'
import { toMajor, toMinor } from '../../utils/money'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { getSetting } from '../../utils/settings'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/finance/topup — add funds to the wallet through a real gateway.
 *
 * Supersedes the old `/api/finance/deposit`, which simply incremented the
 * balance with no money behind it. Here nothing is credited until the
 * provider confirms: the response hands back a redirect or client secret,
 * and the wallet moves only when `settleIntent` runs (synchronously for
 * instant rails, otherwise on the webhook).
 *
 * `deposit` is kept for the dev seed flows but is no longer what the UI calls.
 */

const bodySchema = z.object({
  /** Pounds, as the user typed them — converted to minor units below. */
  amount: z.coerce.number().positive().max(100_000),
  /** Charge a saved instrument instead of an interactive checkout. */
  paymentMethodId: z.string().uuid().optional(),
  returnUrl: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  // Each call hits a paid provider API and creates a PaymentIntent — cap it
  // so a runaway client can't generate thousands of abandoned intents.
  rateLimit(event, { ...RateLimits.payment, identity: session.id })

  const { amount, paymentMethodId, returnUrl } = await validateBody(event, bodySchema)

  const minAmount = await getSetting<number>('finance.topup-min', 5)
  if (amount < minAmount) {
    throw createError({ statusCode: 400, message: `The minimum top-up is £${minAmount}.` })
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { email: true, firstName: true, lastName: true },
  })

  const result = await startPayment({
    userId: session.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    amount: toMinor(amount),
    purpose: 'wallet_topup',
    description: `Apex wallet top-up — £${amount.toFixed(2)}`,
    paymentMethodId,
    returnUrl: returnUrl ?? '/dashboards/wallet',
  })

  return {
    status: 'success',
    reference: result.intent.reference,
    amount: toMajor(result.intent.amount),
    intentStatus: result.intent.status,
    settled: result.settled,
    // Present only when the customer has to finish somewhere else.
    redirectUrl: result.redirectUrl,
    clientSecret: result.clientSecret,
  }
})
