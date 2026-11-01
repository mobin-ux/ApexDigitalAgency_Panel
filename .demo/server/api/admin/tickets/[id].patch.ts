import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { notify } from '../../../utils/notify'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/tickets/:id — triage controls: status, priority,
 * category, assignment. Status/priority values use the canonical
 * vocabulary the customer page's keyword normalization understands.
 * The client is told when staff resolve or close their request, and a newly
 * assigned agent is told it is theirs.
 */

const bodySchema = z
  .object({
    status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    assigneeId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

const auditedFields = {
  id: true,
  subject: true,
  status: true,
  priority: true,
  category: true,
  assigneeId: true,
} as const

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'support.answer')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Ticket id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.ticket.findUnique({ where: { id }, select: { ...auditedFields, userId: true } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }

  if (updates.assigneeId) {
    const agent = await prisma.user.findUnique({ where: { id: updates.assigneeId }, select: { role: true } })
    if (!agent || agent.role === 'CUSTOMER') {
      throw createError({ statusCode: 400, message: 'Assignee must be an admin or employee account' })
    }
  }

  const after = await prisma.ticket.update({
    where: { id },
    data: updates,
    select: auditedFields,
  })

  const { userId: customerId, ...beforeAudit } = before
  await recordAudit(event, admin, {
    action: 'admin.ticket.update',
    targetType: 'Ticket',
    targetId: id,
    metadata: { before: beforeAudit, after },
  })

  if (after.status !== before.status && (after.status === 'RESOLVED' || after.status === 'CLOSED')) {
    await notify({
      userIds: [customerId],
      title: `Request ${after.status === 'RESOLVED' ? 'resolved' : 'closed'}: ${after.subject}`,
      message: after.status === 'RESOLVED'
        ? 'We have marked your request as resolved. Reply if anything is still not right and it will reopen.'
        : 'We have closed your request. Start a new one if you need us again.',
      type: 'SUCCESS',
      link: `/dashboards/support?ticket=${id}`,
    })
  }
  if (after.assigneeId && after.assigneeId !== before.assigneeId) {
    await notify({
      userIds: [after.assigneeId],
      title: `Assigned to you: ${after.subject}`,
      message: 'This support request is now yours.',
      type: 'INFO',
      link: `/admin/tickets?ticket=${id}`,
      excludeUserId: admin.id,
    })
  }

  return after
})
