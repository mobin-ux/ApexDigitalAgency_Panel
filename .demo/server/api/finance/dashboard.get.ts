import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 1. Auth Check
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  // 2. Fetch All Data Parallelly
  const [user, transactions, installments, cards, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { adCredits: true } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.installment.findMany({ where: { userId } }),
    prisma.card.findMany({ where: { userId } }),
    prisma.withdrawalRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  ])

  // 3. Calculate Real Balance
  const cashBalance = transactions.reduce((acc, tx) => acc + tx.amount, 0)

  // 4. Format Activity Stream
  const activities = transactions.map(tx => ({
    id: tx.id,
    title: tx.description || (tx.amount > 0 ? 'Deposit' : 'Payment'),
    sub: tx.type === 'DEPOSIT' ? 'Top-up' : 'Expense',
    date: new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: tx.amount,
    type: tx.amount > 0 ? 'in' : (tx.type === 'AD_CREDIT' ? 'credit' : 'out'),
    icon: tx.amount > 0 ? 'lucide:arrow-down-left' : 'lucide:arrow-up-right'
  }))

  return {
    balanceOverview: {
      cash: cashBalance,
      credits: user?.adCredits || 0,
      monthlyChange: 12.5 // این را می‌توان بعداً با محاسبه دقیق جایگزین کرد
    },
    installments: installments.map(ins => ({
      ...ins,
      nextDue: new Date(ins.nextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })),
    cards,
    activities,
    requests: requests.map(req => ({
      id: req.id,
      title: `Withdrawal #${req.id.substring(0,4)}`,
      date: new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: req.amount,
      status: req.status,
      icon: 'lucide:banknote'
    }))
  }
})