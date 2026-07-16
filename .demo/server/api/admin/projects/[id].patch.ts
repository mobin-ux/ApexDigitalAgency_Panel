import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/projects/:id — whitelisted project update.
 * `amount` is editable here (it's the agreed contract value, not a
 * ledger movement); actual money still only moves through transactions.
 */

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    amount: z.coerce.number().min(0).max(10_000_000).optional(),
    progress: z.coerce.number().int().min(0).max(100).optional(),
    deadline: z.coerce.date().nullable().optional(),
    managerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

const auditedFields = {
  id: true,
  name: true,
  category: true,
  status: true,
  amount: true,
  progress: true,
  deadline: true,
  managerId: true,
} as const

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.project.findUnique({ where: { id }, select: auditedFields })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  if (updates.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: updates.managerId }, select: { role: true } })
    if (!manager || manager.role === 'CUSTOMER') {
      throw createError({ statusCode: 400, message: 'Manager must be an admin or employee account' })
    }
  }

  const after = await prisma.project.update({
    where: { id },
    data: updates,
    select: auditedFields,
  })

  await recordAudit(event, admin, {
    action: 'admin.project.update',
    targetType: 'Project',
    targetId: id,
    metadata: { before, after },
  })

  return after
})
