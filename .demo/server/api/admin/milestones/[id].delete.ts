import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * DELETE /api/admin/milestones/:id — remove a milestone from a timeline.
 */

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Milestone id is required' })
  }

  const before = await prisma.milestone.findUnique({ where: { id } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Milestone not found' })
  }

  await prisma.milestone.delete({ where: { id } })

  await recordAudit(event, admin, {
    action: 'admin.milestone.delete',
    targetType: 'Milestone',
    targetId: id,
    metadata: { before },
  })

  return { status: 'success' }
})
