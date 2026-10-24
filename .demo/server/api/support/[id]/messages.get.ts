import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/support/:id/messages — the customer-visible thread, oldest first,
 * with each staff author's name (Panel v2 shows who answered) and the files
 * attached to each message. Opening the thread also stamps
 * `customerLastSeenAt`, which is what the inbox's unread state compares to.
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
    include: { attachments: { select: { id: true, name: true, size: true } } },
  })

  const staffIds = [...new Set(messages.filter(m => m.isAdmin && m.senderId).map(m => m.senderId!))]
  const staff = staffIds.length
    ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } })
    : []
  const names = new Map(staff.map(u => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ').trim()]))

  await prisma.ticket.update({ where: { id: ticketId }, data: { customerLastSeenAt: new Date() } })

  return {
    messages: messages.map(m => ({
      id: m.id,
      content: m.content,
      isAdmin: m.isAdmin,
      createdAt: m.createdAt,
      author: m.isAdmin ? (names.get(m.senderId ?? '') || 'Apex support') : 'You',
      attachments: m.attachments,
    })),
  }
})
