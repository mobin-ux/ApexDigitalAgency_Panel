import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireAdmin } from '../../../../utils/auth'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * PATCH /api/admin/finance/withdrawals/:id — resolve a Processing
 * withdrawal request. Approving debits the wallet atomically (conditional
 * on sufficient balance — no overdraft) and writes a WITHDRAWAL ledger
 * row; rejecting just flips the status. Only Processing requests can be
 * resolved, and only once.
 */

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Withdrawal id is required' })
  }

  const { action, note } = await validateBody(event, bodySchema)

  const request = await prisma.withdrawalRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, walletBalance: true } } },
  })
  if (!request) {
    throw createError({ statusCode: 404, message: 'Withdrawal request not found' })
  }
  if (request.status !== 'Processing') {
    throw createError({ statusCode: 400, message: 'This request has already been resolved' })
  }

  if (action === 'reject') {
    // Conditional flip so two admins can't both resolve the same request.
    const flipped = await prisma.withdrawalRequest.updateMany({
      where: { id, status: 'Processing' },
      data: { status: 'Rejected' },
    })
    if (flipped.count === 0) {
      throw createError({ statusCode: 400, message: 'This request has already been resolved' })
    }
  }
  else {
    await prisma.$transaction(async (tx) => {
      const flipped = await tx.withdrawalRequest.updateMany({
        where: { id, status: 'Processing' },
        data: { status: 'Completed' },
      })
      if (flipped.count === 0) {
        throw createError({ statusCode: 400, message: 'This request has already been resolved' })
      }

      // Conditional debit — refuses if the wallet no longer covers it.
      const debited = await tx.user.updateMany({
        where: { id: request.userId, walletBalance: { gte: request.amount } },
        data: { walletBalance: { decrement: request.amount } },
      })
      if (debited.count === 0) {
        throw createError({ statusCode: 400, message: 'Insufficient wallet balance to approve this withdrawal' })
      }

      await tx.transaction.create({
        data: {
          userId: request.userId,
          amount: -request.amount,
          type: 'WITHDRAWAL',
          status: 'COMPLETED',
          description: `Withdrawal ${id.slice(0, 8).toUpperCase()} approved${note ? `: ${note}` : ''}`,
        },
      })
    })
  }

  await recordAudit(event, admin, {
    action: `admin.withdrawal.${action}`,
    targetType: 'WithdrawalRequest',
    targetId: id,
    metadata: { amount: request.amount, customer: request.user.email, note: note ?? null },
  })

  return { status: 'success', result: action === 'approve' ? 'Completed' : 'Rejected' }
})
