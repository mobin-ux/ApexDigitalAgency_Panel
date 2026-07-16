import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/** GET /api/support/tickets — the caller's tickets, newest activity first, with the latest message. */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const tickets = await prisma.ticket.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  return { tickets }
})
