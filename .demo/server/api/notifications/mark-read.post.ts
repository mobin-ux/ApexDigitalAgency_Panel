import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/** POST /api/notifications/mark-read — mark all of the caller's notifications read. */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  await prisma.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  })

  return { status: 'success' }
})
