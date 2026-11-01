import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { notifyTicketHandler } from '../../utils/support'
import { validateBody } from '../../utils/validate'

/**
 * PATCH /api/support/:id — the customer marks their own request resolved, or
 * reopens it (Panel v2). Only those two moves: the staff-side states
 * (PENDING, CLOSED) stay with the admin panel. Whoever handles the request
 * is told either way.
 */
const bodySchema = z.object({
  status: z.enum(['RESOLVED', 'OPEN']),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  const { status } = await validateBody(event, bodySchema)

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { userId: true, status: true, subject: true, assigneeId: true, relatedProject: { select: { managerId: true } } } })
  if (!ticket || ticket.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }
  if (ticket.status === 'CLOSED' && status === 'OPEN') {
    throw createError({ statusCode: 400, message: 'This request was closed by our team. Start a new one and we will pick it up.' })
  }
  const updated = await prisma.ticket.update({ where: { id }, data: { status }, select: { id: true, status: true } })
  if (ticket.status !== status) {
    await notifyTicketHandler(
      { id: updated.id, assigneeId: ticket.assigneeId, managerId: ticket.relatedProject?.managerId },
      status === 'RESOLVED'
        ? { title: `Customer resolved: ${ticket.subject}`, message: 'The client marked this request as resolved.', type: 'SUCCESS' }
        : { title: `Customer reopened: ${ticket.subject}`, message: 'The client reopened this request.', type: 'INFO' },
    )
  }
  return updated
})
