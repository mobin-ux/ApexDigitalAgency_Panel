import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { logActivity } from '../../utils/logger'
import prisma from '../../utils/prisma'

/** POST /api/notifications/mark-read — mark all of the caller's notifications read. */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  await prisma.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  })

  logActivity('customer.notification.read-all', 'All notifications marked read')
  return { status: 'success' }
})
