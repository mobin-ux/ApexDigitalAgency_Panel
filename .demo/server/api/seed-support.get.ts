import { defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) return { error: 'Login first' }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

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
          { content: 'Hi, please try using a different card.', isAdmin: true, createdAt: new Date() }
        ]
      }
    }
  })
  
  return { message: 'Support seeded!' }
})