import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { syncProgress } from '../../../utils/project-lifecycle'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/milestones/:id — update a milestone's title/status/date.
 * The project's progress is recomputed from its timeline in the same write.
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
  const admin = await requireStaffPermission(event, 'work.assign')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Milestone id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.milestone.findUnique({ where: { id } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Milestone not found' })
  }

  // Progress follows the timeline, so the client's bar matches its stages.
  const after = await prisma.$transaction(async (tx) => {
    const row = await tx.milestone.update({ where: { id }, data: updates })
    await syncProgress(tx, row.projectId)
    return row
  })

  await recordAudit(event, admin, {
    action: 'admin.milestone.update',
    targetType: 'Milestone',
    targetId: id,
    metadata: { before, after },
  })

  return after
})
