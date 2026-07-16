import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/milestones/:id — update a milestone's title/status/date.
 */

const bodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.enum(['PENDING', 'CURRENT', 'COMPLETED']).optional(),
    date: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Milestone id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.milestone.findUnique({ where: { id } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Milestone not found' })
  }

  const after = await prisma.milestone.update({ where: { id }, data: updates })

  await recordAudit(event, admin, {
    action: 'admin.milestone.update',
    targetType: 'Milestone',
    targetId: id,
    metadata: { before, after },
  })

  return after
})
