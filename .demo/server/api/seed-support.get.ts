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

  await prisma.ticket.create({
    data: {
      userId: decoded.id,
      subject: 'Problem with Payment',
      category: 'Billing',
      priority: 'HIGH',
      status: 'ANSWERED',
      messages: {
        create: [
          { content: 'I cannot top up my wallet.', isAdmin: false, createdAt: new Date(Date.now() - 100000) },
          { content: 'Hi, please try using a different card.', isAdmin: true, createdAt: new Date() },
        ],
      },
    },
  })

  return { message: 'Support seeded!' }
})
