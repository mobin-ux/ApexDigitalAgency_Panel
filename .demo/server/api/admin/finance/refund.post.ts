import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { refundTopUp } from '../../../payments/service'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/finance/refund — refund one ledger row, by what it is
 * (ADR-025: money that came through a provider goes back through it):
 *
 * - a wallet top-up (DEPOSIT) is refunded to the card or account it came
 *   from by `refundTopUp`, through the provider's own refund API, in full or
 *   for `amount` pence. Only what is still in the wallet can go back.
 * - a payment taken from the wallet (PAYMENT, no provider reference) never
 *   touched a provider, so it is refunded to the wallet: the original is
 *   marked REFUNDED and a REFUND row credits the balance, exactly once (the
 *   conditional update below wins any race).
 * - a payment collected by the provider directly (direct debit) is refused
 *   here: it has to be refunded at the provider, which this route cannot do
 *   for that rail yet.
 */

const bodySchema = z.object({
  transactionId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(500),
  /** Top-ups only: pence to refund; omitted, whatever is left of the top-up. */
  amount: z.number().int().positive().optional(),
}).strict()

/** The payment reference `settleIntent` writes into a provider-backed ledger row. */
const REFERENCE = /APX-PI-[0-9A-F]{8}/

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'money.refund')
  const { transactionId, reason, amount: pence } = await validateBody(event, bodySchema)

  const original = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!original) {
    throw createError({ statusCode: 404, message: 'Transaction not found' })
  }
  const reference = original.description?.match(REFERENCE)?.[0] ?? null

  if (original.type === 'DEPOSIT') {
    const intent = reference ? await prisma.paymentIntent.findUnique({ where: { reference }, select: { id: true } }) : null
    if (!intent) {
      throw createError({ statusCode: 409, message: 'This top-up has no payment record to refund against. Refund it from the provider\'s dashboard.' })
    }
    const result = await refundTopUp({ intentId: intent.id, amount: pence, reason, actorId: admin.id })
    await recordAudit(event, admin, {
      action: 'admin.finance.refund',
      targetType: 'Transaction',
      targetId: transactionId,
      reason,
      metadata: { to: 'card', refundId: result.refundId, amountPence: result.amount, status: result.status, reference, customer: original.user.email },
    })
    return { to: 'card' as const, ...result }
  }

  if (original.type !== 'PAYMENT') {
    throw createError({ statusCode: 400, message: 'Only payments and top-ups can be refunded' })
  }
  if (reference) {
    throw createError({ statusCode: 409, message: `This payment (${reference}) was collected by the provider directly. Refund it from the provider's dashboard; the panel cannot refund that rail yet.` })
  }
  if (pence !== undefined) {
    throw createError({ statusCode: 400, message: 'A payment from the wallet is refunded in full.' })
  }
  if (original.status === 'REFUNDED') {
    throw createError({ statusCode: 400, message: 'This payment has already been refunded' })
  }

  const amount = Math.abs(original.amount)

  const refund = await prisma.$transaction(async (tx) => {
    // Conditional flip — fails (count 0) if another request refunded first.
    const flipped = await tx.transaction.updateMany({
      where: { id: transactionId, status: { not: 'REFUNDED' } },
      data: { status: 'REFUNDED' },
    })
    if (flipped.count === 0) {
      throw createError({ statusCode: 400, message: 'This payment has already been refunded' })
    }

    await tx.user.update({
      where: { id: original.userId },
      data: { walletBalance: { increment: amount } },
    })

    return tx.transaction.create({
      data: {
        userId: original.userId,
        amount,
        type: 'REFUND',
        status: 'COMPLETED',
        description: `Refund of ${transactionId.slice(0, 8).toUpperCase()}: ${reason}`,
      },
    })
  })

  await recordAudit(event, admin, {
    action: 'admin.finance.refund',
    targetType: 'Transaction',
    targetId: transactionId,
    reason,
    metadata: { to: 'wallet', refundId: refund.id, amount, customer: original.user.email },
  })

  return { to: 'wallet' as const, refundId: refund.id, status: 'succeeded', amount }
})
