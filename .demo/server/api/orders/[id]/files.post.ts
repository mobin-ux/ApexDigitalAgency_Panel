import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/orders/:id/files — add files the client just uploaded
 * (`POST /api/uploads`) to their order's Files tab. Only the owner's own,
 * still-unattached uploads can be claimed.
 */
const bodySchema = z.object({
  attachmentIds: z.array(z.string().uuid()).min(1).max(5),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  const project = await prisma.project.findFirst({ where: { id, userId: session.id }, select: { id: true, name: true, managerId: true } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Order not found' })
  }
  const { attachmentIds } = await validateBody(event, bodySchema)
  const linked = await prisma.attachment.updateMany({
    where: { id: { in: attachmentIds }, uploaderId: session.id, projectId: null, ticketMessageId: null },
    data: { projectId: project.id },
  })
  if (linked.count !== attachmentIds.length) {
    throw createError({ statusCode: 400, message: 'One of the files is no longer available. Please add it again.' })
  }
  if (project.managerId) {
    await prisma.notification.create({
      data: {
        userId: project.managerId,
        title: 'Client added files',
        message: `${project.name}: ${linked.count} new file${linked.count === 1 ? '' : 's'}.`,
        type: 'INFO',
        link: `/admin/projects/${project.id}`,
      },
    })
  }
  return { ok: true, count: linked.count }
})
