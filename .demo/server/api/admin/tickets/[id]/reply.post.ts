import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/tickets/:id/reply — staff reply or internal note.
 * Internal notes (`isInternal: true`) are visible only in the admin
 * panel; the customer thread endpoint filters them out. A public reply
 * moves an OPEN ticket to PENDING (waiting on the customer) unless the
 * caller sets an explicit status.
 */

const bodySchema = z.object({
  content: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().default(false),
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'support.answer')

  const ticketId = getRouterParam(event, 'id')
  if (!ticketId) {
    throw createError({ statusCode: 400, message: 'Ticket id is required' })
  }

  const { content, isInternal, status } = await validateBody(event, bodySchema)

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } })
  if (!ticket) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }

  const nextStatus = status ?? (!isInternal && ticket.status === 'OPEN' ? 'PENDING' : undefined)

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId,
        content,
        isAdmin: true,
        isInternal,
        senderId: admin.id,
      },
    }),
    // Bump updatedAt so the inbox sorts the ticket to the top (and apply
    // the status transition when there is one).
    prisma.ticket.update({
      where: { id: ticketId },
      data: nextStatus ? { status: nextStatus } : { updatedAt: new Date() },
    }),
  ])

  await recordAudit(event, admin, {
    action: isInternal ? 'admin.ticket.note' : 'admin.ticket.reply',
    targetType: 'Ticket',
    targetId: ticketId,
    metadata: { messageId: message.id, isInternal, statusAfter: nextStatus ?? ticket.status },
  })

  return message
})
