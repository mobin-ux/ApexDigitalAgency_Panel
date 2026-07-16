import process from 'node:process'
import { PrismaClient } from '@prisma/client'
import { createError, defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // Dev-only seed/bootstrap endpoint — must never exist in a production build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const token = getCookie(event, 'auth_token')
  if (!token)
    return { error: 'Login first' }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  await prisma.notification.createMany({
    data: [
      {
        userId: decoded.id,
        title: 'Welcome!',
        message: 'Welcome to your new dashboard.',
        type: 'SUCCESS',
        isRead: false,
      },
      {
        userId: decoded.id,
        title: 'Ticket Replied',
        message: 'Support agent replied to your ticket #TK-9921',
        type: 'INFO',
        isRead: false,
        link: '/dashboards/support',
      },
      {
        userId: decoded.id,
        title: 'Invoice Overdue',
        message: 'Please check your pending invoices.',
        type: 'WARNING',
        isRead: true,
      },
    ],
  })

  return { message: 'Notifications seeded!' }
})
