import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/finance/refund — refund a completed PAYMENT back to the
 * customer's wallet. Money moves only through transactions (ADR-010):
 * atomically marks the original REFUNDED, credits the wallet, and writes
 * a REFUND ledger row. A transaction can be refunded exactly once — the
 * conditional updateMany inside the interactive transaction guarantees it
 * even under concurrent requests.
 */

const bodySchema = z.object({
  transactionId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(500),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { transactionId, reason } = await validateBody(event, bodySchema)

  const original = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!original) {
    throw createError({ statusCode: 404, message: 'Transaction not found' })
  }
  if (original.type !== 'PAYMENT') {
    throw createError({ statusCode: 400, message: 'Only payments can be refunded' })
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
    metadata: { refundId: refund.id, amount, customer: original.user.email, reason },
  })

  return refund
})
