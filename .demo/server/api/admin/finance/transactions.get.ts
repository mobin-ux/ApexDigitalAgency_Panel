import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/finance/transactions — the platform-wide ledger.
 * Query: ?page=&pageSize=&search=&type=&status=&userId=
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  type: z.enum(['DEPOSIT', 'PAYMENT', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT']).optional(),
  status: z.string().trim().max(40).optional(),
  userId: z.string().trim().max(64).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'money.view')
  const { page, pageSize, search, type, status, userId } = validateQuery(event, querySchema)

  const where = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search } },
            { id: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ])

  return paginated(items, total, { page, pageSize })
})
