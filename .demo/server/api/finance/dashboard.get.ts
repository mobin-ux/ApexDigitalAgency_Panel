import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { runAutoPay } from '../../utils/finance'
import prisma from '../../utils/prisma'

/**
 * GET /api/finance/dashboard — wallet overview: balances, recent
 * activity, installments, cards and withdrawal requests, pre-shaped
 * for the Wallet page.
 *
 * Lazy auto-pay runs first: due installments are charged from the
 * wallet here when the user has auto-pay on (there is no cron in this
 * stack — the wallet page is the natural heartbeat, see ADR-014).
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const userId = session.id

  await runAutoPay(userId)

  const [user, transactions, installments, cards, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { adCredits: true, autoPayInstallments: true, walletBalance: true } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.installment.findMany({ where: { userId }, orderBy: { nextDue: 'asc' } }),
    prisma.card.findMany({ where: { userId } }),
    prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  // Cash = ledger sum of the recent transactions window.
  const cashBalance = transactions.reduce((acc, tx) => acc + tx.amount, 0)

  const activities = transactions.map(tx => ({
    id: tx.id,
    title: tx.description || (tx.amount > 0 ? 'Deposit' : 'Payment'),
    sub: tx.type === 'DEPOSIT' ? 'Top-up' : 'Expense',
    date: new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: tx.amount,
    type: tx.amount > 0 ? 'in' : (tx.type === 'AD_CREDIT' ? 'credit' : 'out'),
    icon: tx.amount > 0 ? 'lucide:arrow-down-left' : 'lucide:arrow-up-right',
  }))

  return {
    balanceOverview: {
      cash: cashBalance,
      credits: user?.adCredits || 0,
      walletBalance: user?.walletBalance ?? 0,
      monthlyChange: 12.5, // TODO(api): computed properly in Phase 6 (expenses work)
    },
    autoPayInstallments: user?.autoPayInstallments ?? true,
    installments: installments.map(ins => ({
      ...ins,
      nextDueISO: ins.nextDue,
      nextDue: new Date(ins.nextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })),
    cards,
    activities,
    requests: requests.map(req => ({
      id: req.id,
      title: `Withdrawal #${req.id.substring(0, 4)}`,
      date: new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: req.amount,
      status: req.status,
      icon: 'lucide:banknote',
    })),
  }
})
