import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { cancelProject } from '../../../utils/project-lifecycle'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/contracts/:id — administer a contract's lifecycle status.
 * Audited, and the customer is notified when their contract is cancelled.
 * Cancelling ends the project and stops its plan through `cancelProject`,
 * the same path as cancelling from the project screen, and a cancelled
 * agreement cannot be brought back (ADR-025, phase 4).
 */

const bodySchema = z.object({
  status: z.enum(['SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'money.view')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Contract id is required' })
  }
  const { status } = await validateBody(event, bodySchema)

  const before = await prisma.contract.findUnique({ where: { id }, include: { project: { select: { name: true } } } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Contract not found' })
  }

  if (before.status === 'CANCELLED' && status !== 'CANCELLED') {
    throw createError({ statusCode: 409, message: 'A cancelled agreement stays cancelled: its project and plan have ended.' })
  }

  const cancelling = status === 'CANCELLED' && before.status !== 'CANCELLED'
  const { after, ended } = await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({ where: { id }, data: { status } })
    // Cancelling a contract also cancels the underlying project and its plan.
    return { after: updated, ended: cancelling ? await cancelProject(tx, before.projectId) : null }
  })

  if (cancelling) {
    await notify({
      userIds: [before.userId],
      title: 'Contract cancelled',
      message: `Your contract ${before.reference} for ${before.project?.name ?? 'your project'} has been cancelled.${ended?.planStopped ? ' No further payments will be taken for it.' : ''}`,
      type: 'WARNING',
      link: `/dashboards/orders?project=${before.projectId}`,
    })
  }

  await recordAudit(event, admin, {
    action: 'admin.contract.status',
    targetType: 'Contract',
    targetId: id,
    metadata: { reference: before.reference, before: before.status, after: status, ...(ended ? { cancelled: ended } : {}) },
  })

  return { status: 'success', contract: after }
})
