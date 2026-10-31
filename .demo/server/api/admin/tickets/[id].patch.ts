import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/tickets/:id — triage controls: status, priority,
 * category, assignment. Status/priority values use the canonical
 * vocabulary the customer page's keyword normalization understands.
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

  const before = await prisma.ticket.findUnique({ where: { id }, select: auditedFields })
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

  await recordAudit(event, admin, {
    action: 'admin.ticket.update',
    targetType: 'Ticket',
    targetId: id,
    metadata: { before, after },
  })

  return after
})
