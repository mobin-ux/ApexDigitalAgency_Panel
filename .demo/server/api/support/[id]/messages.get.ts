import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/support/:id/messages — full thread for one ticket.
 * Ownership-checked: previously this route had no auth at all, so any
 * ticket thread was readable by id.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const ticketId = getRouterParam(event, 'id')
  if (!ticketId) {
    throw createError({ statusCode: 400, message: 'Ticket id is required' })
  }

  // 404 for both "doesn't exist" and "not yours" — don't leak ticket ids.
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { userId: true } })
  if (!ticket || ticket.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }

  const messages = await prisma.ticketMessage.findMany({
    // Internal staff notes are admin-panel-only — never in the customer thread.
    where: { ticketId, isInternal: false },
    orderBy: { createdAt: 'asc' },
  })

  return { messages }
})
