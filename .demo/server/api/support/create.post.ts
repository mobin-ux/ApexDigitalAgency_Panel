import { defineEventHandler, readBody, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const body = await readBody(event)

  const ticket = await prisma.ticket.create({
    data: {
      userId: decoded.id,
      subject: body.subject,
      category: body.category,
      priority: body.priority,
      messages: {
        create: {
          content: body.message,
          isAdmin: false
        }
      }
    }
  })

  return { status: 'success', ticket }
})