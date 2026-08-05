import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/contracts/:id — administer a contract's lifecycle status.
 * Audited, and the customer is notified when their contract is cancelled.
 */

const bodySchema = z.object({
  status: z.enum(['SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Contract id is required' })
  }
  const { status } = await validateBody(event, bodySchema)

  const before = await prisma.contract.findUnique({ where: { id }, include: { project: { select: { name: true } } } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Contract not found' })
  }

  const after = await prisma.contract.update({ where: { id }, data: { status } })

  // Cancelling a contract also cancels the underlying project.
  if (status === 'CANCELLED' && before.status !== 'CANCELLED') {
    await prisma.project.update({ where: { id: before.projectId }, data: { status: 'CANCELLED' } })
    await prisma.notification.create({
      data: {
        userId: before.userId,
        title: 'Contract cancelled',
        message: `Your contract ${before.reference} for ${before.project?.name ?? 'your project'} has been cancelled.`,
        type: 'WARNING',
        link: '/dashboards/orders',
      },
    })
  }

  await recordAudit(event, admin, {
    action: 'admin.contract.status',
    targetType: 'Contract',
    targetId: id,
    metadata: { reference: before.reference, before: before.status, after: status },
  })

  return { status: 'success', contract: after }
})
