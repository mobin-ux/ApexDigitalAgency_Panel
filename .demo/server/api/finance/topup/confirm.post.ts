import type { ProviderName } from '../../../payments/types'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { getProviderByName } from '../../../payments/registry'
import { settleIntent } from '../../../payments/service'
import { PaymentProviderError } from '../../../payments/types'
import { requireAuth } from '../../../utils/auth'
import { createLogger } from '../../../utils/logger'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/topup/confirm — complete an interactive top-up that needed
 * a verification step (3-D Secure on cards; simulated on the sandbox rail).
 *
 * The customer completes the bank challenge client-side, then calls this to
 * have us re-read the intent. Settlement is normally driven by the webhook;
 * this endpoint exists so the UI does not have to wait for it.
 *
 * SECURITY — why this asks the provider instead of trusting the local row:
 * `settleIntent` credits the wallet unconditionally, so whoever calls it is
 * asserting "the money arrived". Only two things can honestly make that
 * assertion: a signature-verified webhook, or the provider's own API. This
 * endpoint is neither — it is reachable by any authenticated customer, for
 * their own intent, at any time. Settling on `requires_action` (i.e. an
 * unpaid, un-challenged card) would let a customer mint wallet balance
 * without a charge ever reaching Stripe. So we re-read the charge and settle
 * only on the provider's word.
 *
 * The mock rail's getCharge always reports `succeeded`, so the sandbox
 * demo flow is unchanged.
 *
 * Ownership-checked: a customer can only confirm their own intent.
 */

const log = createLogger('finance:topup-confirm')

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

  const wallet = async () => {
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { walletBalance: true } })
    return user?.walletBalance ?? 0
  }

  if (intent.status === 'succeeded') {
    // Already done — idempotent.
    return { status: 'succeeded', settled: false, walletBalance: await wallet() }
  }
  if (intent.status === 'failed' || intent.status === 'cancelled') {
    throw createError({ statusCode: 409, message: 'This payment can no longer be verified. Please try again.' })
  }

  // --- Confirm with the provider before moving any money --------------------

  const provider = getProviderByName(intent.provider as ProviderName)
  if (!provider) {
    // The rail that created this intent is no longer configured. Refuse
    // rather than settle blind — the webhook will still settle it if the
    // credentials come back.
    log.error('cannot confirm — provider not configured', { reference, provider: intent.provider })
    throw createError({ statusCode: 503, message: 'This payment cannot be verified right now. Please try again shortly.' })
  }
  if (!intent.providerIntentId) {
    log.error('cannot confirm — intent has no provider id', { reference, provider: intent.provider })
    throw createError({ statusCode: 409, message: 'This payment cannot be verified. Please try again.' })
  }

  let charge
  try {
    charge = await provider.getCharge(intent.providerIntentId)
  }
  catch (error: any) {
    const code = error instanceof PaymentProviderError ? error.code : 'provider_error'
    log.error('provider lookup failed during confirm', { reference, provider: intent.provider, code })
    throw createError({ statusCode: 502, message: 'We could not reach the payment provider. Your payment has not been affected.' })
  }

  if (charge.status === 'succeeded') {
    const settled = await settleIntent(intent.id, { feeAmount: charge.feeAmount ?? intent.feeAmount })
    return { status: 'succeeded', settled, walletBalance: await wallet() }
  }

  if (charge.status === 'processing' || charge.status === 'requires_action') {
    // Genuinely not paid yet. Report the truth; the webhook settles it when
    // the provider confirms, and the UI already polls /topup/status.
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: charge.status },
    })
    return { status: charge.status, settled: false, walletBalance: await wallet() }
  }

  // failed / cancelled at the provider — record it so the row stops lying.
  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: charge.status,
      failureCode: charge.failureCode ?? 'not_completed',
      failureMessage: charge.failureMessage?.slice(0, 500) ?? null,
    },
  })
  throw createError({
    statusCode: 402,
    message: charge.failureMessage ?? 'Your payment was not completed. No money has left your account.',
  })
})
