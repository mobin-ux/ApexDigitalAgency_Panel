import { defineEventHandler, readBody, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  const body = await readBody(event)
  const amount = Number(body.amount)

  if (!amount || amount <= 0) throw createError({ statusCode: 400, message: 'Invalid amount' })

  // ثبت تراکنش واریز
  const tx = await prisma.transaction.create({
    data: {
      userId: decoded.id,
      amount: amount, // مثبت برای واریز
      type: 'DEPOSIT',
      status: 'COMPLETED',
      description: 'Wallet Top-up via Credit Card'
    }
  })

  return { status: 'success', balance: amount }
})