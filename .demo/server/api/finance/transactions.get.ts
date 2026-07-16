import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/** GET /api/finance/transactions — the caller's 20 most recent ledger entries. */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Ledger sum of the returned window (kept for the existing consumers).
  const balance = transactions.reduce((acc, tx) => acc + tx.amount, 0)

  return {
    balance,
    transactions: transactions.map(tx => ({
      id: tx.id,
      type: tx.type, // DEPOSIT, PAYMENT, REFUND
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      date: tx.createdAt,
    })),
  }
})
