import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/support/:id/reply — customer reply into their own ticket.
 * Ownership-checked: previously this route had no auth at all, so
 * anyone could post into any ticket.
 */

const bodySchema = z.object({
  content: z.string().trim().min(1).max(10_000),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const ticketId = getRouterParam(event, 'id')
  if (!ticketId) {
    throw createError({ statusCode: 400, message: 'Ticket id is required' })
  }

  const { content } = await validateBody(event, bodySchema)

  // 404 for both "doesn't exist" and "not yours" — don't leak ticket ids.
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { userId: true } })
  if (!ticket || ticket.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId,
        content,
        isAdmin: false,
        senderId: session.id,
      },
    }),
    // Bump the ticket so it sorts to the top of the inbox and reopens if resolved.
    prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date(), status: 'OPEN' },
    }),
  ])

  return { status: 'success', message }
})
