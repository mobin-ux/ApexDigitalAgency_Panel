import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/projects/:id — whitelisted project update.
 * `amount` (the agreed value) is editable only on a project with no signed
 * agreement. Once the client has signed, the price is the agreement's and
 * the plan's (ADR-025): changing it here would show the client a total that
 * differs from what they agreed and from the cash price, so it is refused.
 * Money itself only moves through transactions either way.
 */

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']).optional(),
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
  const admin = await requireStaffPermission(event, 'work.assign')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.project.findUnique({ where: { id }, select: { ...auditedFields, signedAt: true, contract: { select: { id: true } } } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  if (updates.amount !== undefined && updates.amount !== before.amount && (before.signedAt || before.contract)) {
    throw createError({ statusCode: 409, message: 'The client has signed an agreement for this project, so its value is fixed. Cancel and re-quote instead.' })
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
