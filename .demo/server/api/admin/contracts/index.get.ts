import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/contracts — Contract Management: every signed financing
 * agreement across all customers, newest first.
 * Query: ?page=&pageSize=&search=&status=&userId=
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  userId: z.string().trim().max(64).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { page, pageSize, search, status, userId } = validateQuery(event, querySchema)

  const where = {
    ...(status ? { status } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search } },
            { project: { name: { contains: search } } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }

  const [items, total, statusRows, valueAgg] = await prisma.$transaction([
    prisma.contract.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, avatar: true } },
        project: { select: { id: true, name: true, category: true, status: true, progress: true } },
      },
    }),
    prisma.contract.count({ where }),
    // Status counts for the summary tiles (unfiltered totals).
    prisma.contract.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.contract.aggregate({ _sum: { amount: true } }),
  ])

  const statusCounts: Record<string, number> = { SIGNED: 0, ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 }
  for (const row of statusRows) {
    statusCounts[row.status] = row._count._all
  }

  return {
    ...paginated(items, total, { page, pageSize }),
    statusCounts,
    totalValue: valueAgg._sum.amount ?? 0,
  }
})
