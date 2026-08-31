import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { activeRelease } from '../../../../../utils/deliverables'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'

/**
 * POST /api/admin/projects/:id/deliverables/withdraw — take back the
 * client's access to the project's files.
 *
 * The release row is stamped rather than deleted. A deleted row would
 * take the hand-over out of the history with it, and the whole point of
 * recording who released files early is that the record survives the
 * decision being reversed.
 *
 * Withdrawal only restores the platform gate; it does not invent one. If
 * `deliverables.hold-until-paid` is off, or the balance is settled, the
 * files stay available and the panel says so — the alternative would be a
 * button that reports success and changes nothing the client can see.
 */

const bodySchema = z.object({
  reason: z.string().trim().max(1000).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.release')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const { reason } = await validateBody(event, bodySchema)

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const release = await activeRelease(id)
  if (!release) {
    throw createError({ statusCode: 409, message: 'These files are not currently released.' })
  }

  /*
   * Conditional update: `withdrawnAt: null` in the where-clause means two
   * racing withdrawals settle the row once, and the loser gets the 409
   * below rather than overwriting the first one's actor and timestamp.
   */
  const claimed = await prisma.deliverableRelease.updateMany({
    where: { id: release.id, withdrawnAt: null },
    data: {
      withdrawnAt: new Date(),
      withdrawnById: admin.id,
      withdrawnByEmail: admin.email,
      withdrawnByRole: admin.staffRole,
      withdrawnReason: reason || null,
    },
  })
  if (claimed.count === 0) {
    throw createError({ statusCode: 409, message: 'These files are not currently released.' })
  }

  await recordAudit(event, admin, {
    action: 'admin.project.deliverables.withdraw',
    targetType: 'Project',
    targetId: id,
    subject: project.name,
    reason,
    metadata: { releaseId: release.id, releasedAt: release.releasedAt, releasedBy: release.actorEmail },
  })

  return { ok: true }
})
