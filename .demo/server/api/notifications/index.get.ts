import { defineEventHandler } from 'h3'
import { getAuthSession } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/notifications — latest 20 + unread count.
 * Soft-fails to an empty list for anonymous sessions: the toolbar
 * polls this endpoint on every page, signed in or not.
 */
export default defineEventHandler(async (event) => {
  const session = getAuthSession(event)
  if (!session) {
    return { notifications: [], unreadCount: 0 }
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.notification.count({
      where: { userId: session.id, isRead: false },
    }),
  ])

  return { notifications, unreadCount }
})
