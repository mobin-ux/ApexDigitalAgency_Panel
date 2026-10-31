import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../../../../utils/auth'
import prisma from '../../../../../utils/prisma'

/**
 * POST /api/orders/:id/actions/:actionId/complete — the client approves or
 * chooses what their team asked for. Ownership is checked through the
 * action's own `userId`, and a conditional update makes a double click land
 * once. The project lead is notified, so the answer does not wait for
 * someone to open the screen.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const projectId = getRouterParam(event, 'id')
  const actionId = getRouterParam(event, 'actionId')

  const action = await prisma.clientAction.findFirst({
    where: { id: actionId, projectId, userId: session.id },
    include: { project: { select: { name: true, managerId: true } } },
  })
  if (!action) {
    throw createError({ statusCode: 404, message: 'Request not found' })
  }
  const done = await prisma.clientAction.updateMany({
    where: { id: action.id, status: 'OPEN' },
    data: { status: 'DONE', resolvedAt: new Date() },
  })
  if (done.count === 0) {
    throw createError({ statusCode: 409, message: 'This request has already been answered.' })
  }

  const recipient = action.project.managerId ?? action.createdById
  if (recipient) {
    await notify({
      userIds: [recipient],
      title: 'Client answered',
      message: `${action.project.name}: "${action.title}" is done.`,
      type: 'SUCCESS',
    })
  }
  return { ok: true, doneLine: action.doneLine }
})
