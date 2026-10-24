import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/finance/transactions — the caller's most recent ledger entries,
 * newest first. `?limit=` up to 500 (default 20, which the older consumers
 * rely on); Panel v2's Wallet asks for its full history so the filter and the
 * CSV export cover every row rather than the first page.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const limit = Math.min(500, Math.max(1, Number(getQuery(event).limit) || 20))

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
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
      projectId: tx.projectId,
      date: tx.createdAt,
    })),
  }
})
