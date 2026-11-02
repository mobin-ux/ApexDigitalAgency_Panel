import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '../utils/auth'
import prisma from '../utils/prisma'

export default defineEventHandler(async (event) => {
  // Dev-only seed/bootstrap endpoint — must never exist in a production build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  // The signed-in account, through the same check as every other route (the
  // seeds used to verify the token with a fallback secret and 500'd, AUD-15).
  const decoded = requireAuth(event)
  const userId = decoded.id

  // 1. Create Cards
  await prisma.card.create({
    data: {
      type: 'Mastercard',
      last4: '4479',
      holderName: 'Admin User',
      expiryDate: '12/28',
      userId,
    },
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
        userId,
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
        userId,
      },
    ],
  })

  // 3. Update User Credits
  await prisma.user.update({
    where: { id: userId },
    data: { adCredits: 1143 },
  })

  return { message: 'Wallet seeded!' }
})
