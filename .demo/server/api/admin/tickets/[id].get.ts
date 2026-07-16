import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/tickets/:id — full ticket for the admin panel: customer,
 * assignee, the complete thread INCLUDING internal staff notes (which the
 * customer endpoints filter out), and the staff directory for assignment.
 */

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Ticket id is required' })
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, createdAt: true, _count: { select: { tickets: true, projects: true } } } },
      assignee: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!ticket) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }

  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EMPLOYEE'] } },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
    orderBy: { email: 'asc' },
  })

  return { ticket, staff }
})
