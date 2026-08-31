import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/finance/withdrawals — withdrawal request queue.
 * Query: ?page=&pageSize=&status= (Processing | Completed | Rejected)
 */

const querySchema = paginationQuerySchema.extend({
  status: z.enum(['Processing', 'Completed', 'Rejected']).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'money.view')
  const { page, pageSize, status } = validateQuery(event, querySchema)

  const where = status ? { status } : {}

  const [items, total] = await prisma.$transaction([
    prisma.withdrawalRequest.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true, walletBalance: true } },
      },
    }),
    prisma.withdrawalRequest.count({ where }),
  ])

  return paginated(items, total, { page, pageSize })
})
