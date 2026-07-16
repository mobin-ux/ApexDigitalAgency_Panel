import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/finance/deposit — wallet top-up.
 * Writes the ledger entry AND increments the denormalized
 * `User.walletBalance` in one transaction — the previous version only
 * wrote the ledger, so the balance column (read by /dashboard/stats
 * and debited by /orders/pay) silently drifted after every top-up.
 *
 * TODO(api): no real payment processing — this credits the wallet
 * directly (dev behaviour, consistent with ADR-010).
 */

const bodySchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { amount } = await validateBody(event, bodySchema)

  const [, user] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId: session.id,
        amount, // positive = credit
        type: 'DEPOSIT',
        status: 'COMPLETED',
        description: 'Wallet Top-up via Credit Card',
      },
    }),
    prisma.user.update({
      where: { id: session.id },
      data: { walletBalance: { increment: amount } },
      select: { walletBalance: true },
    }),
  ])

  return { status: 'success', balance: user.walletBalance }
})
