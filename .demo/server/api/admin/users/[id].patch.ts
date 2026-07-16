import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/users/:id — constrained admin update of a customer.
 * Exemplar for every future admin mutation: requireAdmin → whitelist-
 * validated body → update → audit row with before/after snapshots.
 *
 * Deliberately NOT updatable here: password (needs a dedicated reset
 * flow), walletBalance (money moves only through transactions —
 * ADR-010), email (identity change needs verification).
 */

const bodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    role: z.enum(['CUSTOMER', 'ADMIN', 'EMPLOYEE']).optional(),
    adCredits: z.number().min(0).max(1_000_000).optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

const auditedFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  city: true,
  country: true,
  role: true,
  adCredits: true,
} as const

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'User id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.user.findUnique({ where: { id }, select: auditedFields })
  if (!before) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Safety rail: admins cannot change their own role (prevents locking
  // the last admin out of the panel mid-session).
  if (id === admin.id && updates.role && updates.role !== 'ADMIN') {
    throw createError({ statusCode: 400, message: 'You cannot change your own role' })
  }

  const after = await prisma.user.update({
    where: { id },
    data: updates,
    select: auditedFields,
  })

  await recordAudit(event, admin, {
    action: 'admin.user.update',
    targetType: 'User',
    targetId: id,
    metadata: { before, after },
  })

  return after
})
