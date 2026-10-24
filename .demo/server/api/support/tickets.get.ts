import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/support/tickets — the caller's tickets, newest activity first, with
 * the latest message the customer is allowed to see and the order it is about.
 *
 * The latest-message include filters out internal staff notes. It used to
 * take the newest message of any kind, so an internal note could become the
 * preview line in the customer's own inbox.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const tickets = await prisma.ticket.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      relatedProject: { select: { id: true, name: true } },
    },
  })

  return { tickets }
})
