import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireAdmin } from '../../../../utils/auth'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/projects/:id/milestones — append a milestone to a
 * project's timeline. Status vocabulary matches the customer pages:
 * PENDING | CURRENT | COMPLETED.
 */

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  status: z.enum(['PENDING', 'CURRENT', 'COMPLETED']).default('PENDING'),
  date: z.coerce.date().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const { title, status, date } = await validateBody(event, bodySchema)

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const milestone = await prisma.milestone.create({
    data: { title, status, date: date ?? null, projectId },
  })

  await recordAudit(event, admin, {
    action: 'admin.milestone.create',
    targetType: 'Milestone',
    targetId: milestone.id,
    metadata: { projectId, title, status },
  })

  return milestone
})
