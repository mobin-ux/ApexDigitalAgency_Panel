import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/users — paginated, searchable customer directory.
 * Query: ?page=&pageSize=&search=&role=
 * Exemplar for every future admin list endpoint: requireAdmin →
 * validated query → shared prisma → `paginated()` envelope.
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'EMPLOYEE']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { page, pageSize, search, role } = validateQuery(event, querySchema)

  const where = {
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
      // Explicit select — the password hash must never leave the server.
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        city: true,
        country: true,
        walletBalance: true,
        adCredits: true,
        createdAt: true,
        _count: { select: { projects: true, tickets: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return paginated(items, total, { page, pageSize })
})
