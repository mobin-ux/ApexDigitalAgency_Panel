import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * DELETE /api/admin/projects/:id — hard delete (milestones/files cascade).
 * The full before-snapshot goes into the audit trail since the row is gone.
 * For "the project fell through" prefer PATCH status=CANCELLED — deletion
 * is for test data and duplicates.
 */

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const before = await prisma.project.findUnique({
    where: { id },
    include: { user: { select: { email: true } }, _count: { select: { milestones: true, files: true } } },
  })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  await prisma.project.delete({ where: { id } })

  await recordAudit(event, admin, {
    action: 'admin.project.delete',
    targetType: 'Project',
    targetId: id,
    metadata: { before },
  })

  return { status: 'success' }
})
