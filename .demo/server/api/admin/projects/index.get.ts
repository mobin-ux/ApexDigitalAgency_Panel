import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/projects — paginated project directory across all customers.
 * Query: ?page=&pageSize=&search=&status=&category=&userId=
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  category: z.string().trim().max(100).optional(),
  userId: z.string().trim().max(64).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { page, pageSize, search, status, category, userId } = validateQuery(event, querySchema)

  const where = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { id: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }

  const [items, total, categories] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        manager: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { milestones: true, files: true } },
      },
    }),
    prisma.project.count({ where }),
    // Distinct categories power the filter dropdown without a second request.
    prisma.project.findMany({ select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } }),
  ])

  return {
    ...paginated(items, total, { page, pageSize }),
    categories: categories.map(c => c.category),
  }
})
