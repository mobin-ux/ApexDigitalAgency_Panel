import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * POST /api/notifications/:id/read — mark one of the caller's notifications
 * read (Panel v2: opening a row in the bell's panel). Scoped by owner in the
 * update itself, so another account's id is a 404 rather than a quiet no-op.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id') ?? ''

  const { count } = await prisma.notification.updateMany({
    where: { id, userId: session.id },
    data: { isRead: true },
  })
  if (count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Notification not found' })
  }

  return { status: 'success' }
})
