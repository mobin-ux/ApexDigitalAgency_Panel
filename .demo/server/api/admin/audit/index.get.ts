import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/audit — the privileged-action trail, paginated.
 * Query: ?page=&pageSize=&search=&action=&targetType=
 * `action` matches as a prefix (e.g. "admin.user." covers every user verb).
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  action: z.string().trim().max(100).optional(),
  targetType: z.string().trim().max(50).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { page, pageSize, search, action, targetType } = validateQuery(event, querySchema)

  const where = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(targetType ? { targetType } : {}),
    ...(search
      ? {
          OR: [
            { actorEmail: { contains: search } },
            { targetId: { contains: search } },
            { action: { contains: search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ])

  return paginated(items, total, { page, pageSize })
})
