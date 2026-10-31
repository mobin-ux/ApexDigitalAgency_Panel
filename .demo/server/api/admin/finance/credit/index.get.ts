import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../../utils/http'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateQuery } from '../../../../utils/validate'

/**
 * GET /api/admin/finance/credit — credit-line queue. PENDING
 * applications first (that's the work queue), then by application date.
 */

const querySchema = paginationQuerySchema.extend({
  status: z.enum(['PENDING', 'ACTIVE', 'FROZEN', 'REJECTED']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'money.view')
  const { page, pageSize, status } = validateQuery(event, querySchema)

  const where = status ? { status } : {}

  const [items, total] = await prisma.$transaction([
    prisma.creditLine.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: [{ status: 'asc' }, { appliedAt: 'desc' }], // PENDING < others alphabetically? no — explicit sort below
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, walletBalance: true } },
      },
    }),
    prisma.creditLine.count({ where }),
  ])

  // PENDING first regardless of alphabetical enum order.
  items.sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING'))

  return paginated(items, total, { page, pageSize })
})
