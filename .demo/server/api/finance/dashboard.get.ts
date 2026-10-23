import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { ensureCredit } from '../../utils/credit'
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

  // Instant Apex credit facility — ensured (and usage recomputed) on every load.
  const creditSummary = await ensureCredit(userId)

  const [user, transactions, installments, cards, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { adCredits: true, autoPayInstallments: true, walletBalance: true } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.installment.findMany({ where: { userId }, orderBy: { nextDue: 'asc' } }),
    prisma.card.findMany({ where: { userId } }),
    prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  ])

  /*
   * Cash is the wallet balance: the column every charge checks and every
   * settlement moves. It used to be the sum of the ten newest transactions,
   * which is a different number for any account with more history than
   * that — the Wallet page could show £1,000 while an instalment was refused
   * for an empty wallet.
   */
  const cashBalance = user?.walletBalance ?? 0
  const shortDate = (value: Date) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  const activities = transactions.map(tx => ({
    id: tx.id,
    title: tx.description || (tx.amount > 0 ? 'Deposit' : 'Payment'),
    sub: tx.type === 'DEPOSIT' ? 'Top-up' : 'Expense',
    date: shortDate(tx.createdAt),
    amount: tx.amount,
    type: tx.amount > 0 ? 'in' : (tx.type === 'AD_CREDIT' ? 'credit' : 'out'),
    icon: tx.amount > 0 ? 'lucide:arrow-down-left' : 'lucide:arrow-up-right',
  }))

  return {
    balanceOverview: {
      cash: cashBalance,
      credits: user?.adCredits || 0,
      walletBalance: user?.walletBalance ?? 0,
    },
    autoPayInstallments: user?.autoPayInstallments ?? true,
    // Instant Apex credit facility: fixed limit (default £20,000), no
    // application. `used` = outstanding principal across active financed
    // projects; `available` = limit − used.
    credit: {
      status: creditSummary.status,
      limit: creditSummary.limit,
      used: creditSummary.used,
      available: creditSummary.available,
    },
    installments: installments.map(ins => ({
      ...ins,
      nextDueISO: ins.nextDue,
      nextDue: shortDate(ins.nextDue),
    })),
    cards,
    activities,
    requests: requests.map(req => ({
      id: req.id,
      title: `Withdrawal #${req.id.substring(0, 4)}`,
      date: shortDate(req.createdAt),
      amount: req.amount,
      status: req.status,
      icon: 'lucide:banknote',
    })),
  }
})
