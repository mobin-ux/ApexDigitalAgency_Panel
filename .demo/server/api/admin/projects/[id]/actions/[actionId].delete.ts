import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'

/**
 * DELETE /api/admin/projects/:id/actions/:actionId — withdraw a request the
 * client has not answered. Stamps CANCELLED rather than deleting, so the
 * project keeps the record of what was asked.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')
  const id = getRouterParam(event, 'id')
  const actionId = getRouterParam(event, 'actionId')
  const result = await prisma.clientAction.updateMany({
    where: { id: actionId, projectId: id, status: 'OPEN' },
    data: { status: 'CANCELLED', resolvedAt: new Date() },
  })
  if (result.count === 0) {
    throw createError({ statusCode: 409, message: 'That request has already been answered or withdrawn.' })
  }
  await recordAudit(event, admin, { action: 'admin.project.action-cancel', targetType: 'Project', targetId: id, metadata: { actionId } })
  return { ok: true }
})
