import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'

/**
 * POST /api/admin/projects/:id/actions — ask the client for something
 * (Panel v2 "Waiting on you"): approve a design, choose a direction.
 *
 * The client sees it on the dashboard and on the order, and completes it
 * there. `doneLine` is the sentence they read afterwards, written by the
 * person who knows what happens next rather than generated.
 */
const bodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(400).optional(),
  ctaLabel: z.string().trim().min(2).max(24).default('Approve'),
  doneLine: z.string().trim().max(200).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true, name: true } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  const input = await validateBody(event, bodySchema)

  const action = await prisma.clientAction.create({
    data: { ...input, projectId: id, userId: project.userId, createdById: admin.id },
  })
  await prisma.notification.create({
    data: {
      userId: project.userId,
      title: 'Waiting on you',
      message: `${project.name}: ${input.title}.`,
      type: 'INFO',
      link: `/dashboards/orders?project=${id}`,
    },
  })
  await recordAudit(event, admin, {
    action: 'admin.project.action-request',
    targetType: 'Project',
    targetId: id,
    metadata: { actionId: action.id, title: input.title },
  })
  return action
})
