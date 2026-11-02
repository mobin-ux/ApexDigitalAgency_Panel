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
