import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { toMajor } from '../../../utils/money'
import prisma from '../../../utils/prisma'

/**
 * GET /api/finance/topup/status?reference=… — current state of a top-up intent.
 *
 * Used by the UI to poll a payment that is still clearing (a Direct Debit
 * collection reports `processing` until the scheme settles it, a few working
 * days later). Ownership-checked; returns display-safe fields only.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const reference = String(getQuery(event).reference ?? '').trim()
  if (!reference) {
    throw createError({ statusCode: 400, message: 'reference is required' })
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { reference, userId: session.id },
    select: { reference: true, status: true, amount: true, currency: true, failureMessage: true, settledAt: true },
  })
  if (!intent) {
    throw createError({ statusCode: 404, message: 'Payment not found.' })
  }

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { walletBalance: true } })

  return {
    reference: intent.reference,
    status: intent.status,
    settled: intent.status === 'succeeded',
    amount: toMajor(intent.amount, intent.currency),
    failureMessage: intent.failureMessage,
    settledAt: intent.settledAt,
    walletBalance: user?.walletBalance ?? 0,
  }
})
