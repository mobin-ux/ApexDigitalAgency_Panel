import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  // دریافت تراکنش‌ها
  const transactions = await prisma.transaction.findMany({
    where: { userId: decoded.id },
    orderBy: { createdAt: 'desc' },
    take: 20 // فعلا ۲۰ تای آخر
  })

  // محاسبه موجودی کل (جمع تمام تراکنش‌ها)
  const balance = transactions.reduce((acc, tx) => acc + tx.amount, 0)

  return { 
    balance,
    transactions: transactions.map(tx => ({
      id: tx.id,
      type: tx.type, // DEPOSIT, PAYMENT, REFUND
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      date: tx.createdAt
    }))
  }
})