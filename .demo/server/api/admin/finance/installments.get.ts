import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/finance/installments — platform-wide installment plans.
 * NOTE: the Installment model is not FK-linked to Project (ADR-010) —
 * `project` is a display name. This endpoint surfaces what exists; per-
 * project plan management stays blocked on the schema gap (REQUIREMENTS §6).
 */

const querySchema = paginationQuerySchema.extend({
  status: z.string().trim().max(40).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'money.view')
  const { page, pageSize, status } = validateQuery(event, querySchema)

  const where = status ? { status } : {}

  const [items, total] = await prisma.$transaction([
    prisma.installment.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { nextDue: 'asc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    }),
    prisma.installment.count({ where }),
  ])

  return paginated(items, total, { page, pageSize })
})
