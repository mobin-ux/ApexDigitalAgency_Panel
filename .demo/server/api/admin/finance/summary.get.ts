import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/finance/summary — headline financial aggregates for the
 * Payments module. Raw numbers only; formatting is the client's job.
 */

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [payments, payments30d, deposits, walletLiability, pendingWithdrawals, installmentsDue] = await prisma.$transaction([
    prisma.transaction.aggregate({ _sum: { amount: true }, _count: true, where: { type: 'PAYMENT' } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'DEPOSIT' } }),
    prisma.user.aggregate({ _sum: { walletBalance: true } }),
    prisma.withdrawalRequest.aggregate({ _sum: { amount: true }, _count: true, where: { status: 'Processing' } }),
    prisma.installment.aggregate({ _sum: { amountDue: true }, _count: true }),
  ])

  return {
    totalRevenue: payments._sum.amount ?? 0,
    paymentCount: payments._count,
    revenue30d: payments30d._sum.amount ?? 0,
    totalDeposits: deposits._sum.amount ?? 0,
    // Sum of all customer wallets — what the platform owes its users.
    walletLiability: walletLiability._sum.walletBalance ?? 0,
    pendingWithdrawalCount: pendingWithdrawals._count,
    pendingWithdrawalAmount: pendingWithdrawals._sum.amount ?? 0,
    installmentCount: installmentsDue._count,
    installmentOutstanding: installmentsDue._sum.amountDue ?? 0,
  }
})
