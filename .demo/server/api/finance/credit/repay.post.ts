import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/credit/repay — pay down the used credit balance
 * from the wallet. Atomic: conditional wallet debit (no overdraft),
 * `used` decrement capped at the outstanding amount, ledger row.
 */

const bodySchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { amount } = await validateBody(event, bodySchema)

  const result = await prisma.$transaction(async (tx) => {
    const line = await tx.creditLine.findUnique({ where: { userId: session.id } })
    if (!line || line.status !== 'ACTIVE') {
      return { ok: false as const, error: 'no_line' as const }
    }
    if (line.used <= 0) {
      return { ok: false as const, error: 'nothing_due' as const }
    }

    const repay = Math.round(Math.min(amount, line.used) * 100) / 100
    const debited = await tx.user.updateMany({
      where: { id: session.id, walletBalance: { gte: repay } },
      data: { walletBalance: { decrement: repay } },
    })
    if (debited.count === 0) {
      return { ok: false as const, error: 'insufficient' as const }
    }

    const updated = await tx.creditLine.update({
      where: { userId: session.id },
      data: { used: Math.max(0, Math.round((line.used - repay) * 100) / 100) },
    })
    await tx.transaction.create({
      data: {
        userId: session.id,
        amount: -repay,
        type: 'CREDIT_REPAY',
        description: `Apex credit repayment`,
      },
    })
    return { ok: true as const, repaid: repay, credit: updated }
  })

  if (!result.ok) {
    if (result.error === 'no_line') {
      throw createError({ statusCode: 400, message: 'No active credit line to repay.' })
    }
    if (result.error === 'nothing_due') {
      throw createError({ statusCode: 400, message: 'Nothing to repay — your credit balance is clear.' })
    }
    throw createError({ statusCode: 400, message: 'Insufficient wallet balance. Please top up first.' })
  }

  return { status: 'success', repaid: result.repaid, credit: result.credit }
})
