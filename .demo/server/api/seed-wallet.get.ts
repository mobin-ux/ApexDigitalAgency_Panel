import { defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) return { error: 'Login first' }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  // 1. Create Cards
  await prisma.card.create({
    data: {
      type: 'Mastercard',
      last4: '4479',
      holderName: 'Admin User',
      expiryDate: '12/28',
      balance: 9543.13,
      limit: 5000,
      userId
    }
  })

  // 2. Create Installments
  await prisma.installment.createMany({
    data: [
      {
        project: 'E-Commerce Redesign',
        total: 3600,
        paid: 900,
        amountDue: 300,
        monthsTotal: 12,
        monthsPaid: 3,
        nextDue: new Date('2026-02-01'),
        status: 'active',
        icon: 'lucide:monitor',
        userId
      },
      {
        project: 'Server Hardware',
        total: 2400,
        paid: 2000,
        amountDue: 400,
        monthsTotal: 6,
        monthsPaid: 5,
        nextDue: new Date('2026-01-15'),
        status: 'urgent',
        icon: 'lucide:server',
        userId
      }
    ]
  })

  // 3. Update User Credits
  await prisma.user.update({
    where: { id: userId },
    data: { adCredits: 1143 }
  })

  return { message: 'Wallet seeded!' }
})