import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/users/:id/wallet — manual wallet adjustment (credit or
 * debit) with a mandatory reason. This is the ONLY way an admin moves
 * wallet money: it always writes an ADJUSTMENT ledger row alongside the
 * balance change (ADR-010 — the column must never drift from the ledger).
 * Debits are conditional on sufficient balance; wallets can't go negative.
 */

const bodySchema = z.object({
  // Positive = credit, negative = debit. Zero is meaningless.
  amount: z.coerce.number().min(-1_000_000).max(1_000_000).refine(v => v !== 0, { message: 'Amount cannot be zero' }),
  reason: z.string().trim().min(3).max(500),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'money.view')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'User id is required' })
  }

  const { amount, reason } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, walletBalance: true } })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const entry = await prisma.$transaction(async (tx) => {
    if (amount < 0) {
      const debited = await tx.user.updateMany({
        where: { id, walletBalance: { gte: Math.abs(amount) } },
        data: { walletBalance: { increment: amount } },
      })
      if (debited.count === 0) {
        throw createError({ statusCode: 400, message: 'Adjustment would make the wallet balance negative' })
      }
    }
    else {
      await tx.user.update({ where: { id }, data: { walletBalance: { increment: amount } } })
    }

    return tx.transaction.create({
      data: {
        userId: id,
        amount,
        type: 'ADJUSTMENT',
        status: 'COMPLETED',
        description: `Admin adjustment: ${reason}`,
      },
    })
  })

  await recordAudit(event, admin, {
    action: 'admin.user.wallet-adjust',
    targetType: 'User',
    targetId: id,
    metadata: { amount, reason, transactionId: entry.id, balanceBefore: user.walletBalance },
  })

  return entry
})
