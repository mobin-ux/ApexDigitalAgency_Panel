import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/tickets — support inbox across all customers.
 * Query: ?page=&pageSize=&search=&status=&priority=&assignee=
 * `assignee` accepts a user id, "me", or "unassigned".
 * Status/priority are free-text schema fields (matches the customer page's
 * keyword normalization) so they're filtered as case-insensitive contains.
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  priority: z.string().trim().max(40).optional(),
  assignee: z.string().trim().max(64).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { page, pageSize, search, status, priority, assignee } = validateQuery(event, querySchema)

  const where = {
    ...(status ? { status: { contains: status } } : {}),
    ...(priority ? { priority: { contains: priority } } : {}),
    ...(assignee === 'unassigned'
      ? { assigneeId: null }
      : assignee === 'me'
        ? { assigneeId: admin.id }
        : assignee
          ? { assigneeId: assignee }
          : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search } },
            { id: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, isAdmin: true, isInternal: true, createdAt: true },
        },
      },
    }),
    prisma.ticket.count({ where }),
  ])

  return paginated(items, total, { page, pageSize })
})
