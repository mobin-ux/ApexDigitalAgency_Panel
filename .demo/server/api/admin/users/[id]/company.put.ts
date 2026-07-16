import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireAdmin } from '../../../../utils/auth'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * PUT /api/admin/users/:id/company — create or update the company
 * profile attached to a user account. A user with a Company row is a
 * "company account" everywhere in the panel (account type is derived,
 * not stored). Send `remove: true` to detach the profile and turn the
 * account back into an individual one.
 */

const bodySchema = z.union([
  z.object({ remove: z.literal(true) }),
  z
    .object({
      name: z.string().trim().min(1).max(200),
      email: z.string().trim().toLowerCase().email().nullable().optional(),
      website: z.string().trim().max(300).nullable().optional(),
      phone: z.string().trim().max(30).nullable().optional(),
      taxId: z.string().trim().max(100).nullable().optional(),
      address: z.string().trim().max(500).nullable().optional(),
      type: z.string().trim().max(100).nullable().optional(),
      employees: z.string().trim().max(50).nullable().optional(),
      status: z.enum(['Active', 'Inactive']).default('Active'),
      notes: z.string().trim().max(2000).nullable().optional(),
    })
    .strict(),
])

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User id is required' })
  }

  const body = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, company: true } })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if ('remove' in body) {
    if (!user.company) {
      throw createError({ statusCode: 400, message: 'This account has no company profile' })
    }
    await prisma.company.delete({ where: { userId } })
    await recordAudit(event, admin, {
      action: 'admin.company.remove',
      targetType: 'Company',
      targetId: user.company.id,
      metadata: { user: user.email, before: user.company },
    })
    return { status: 'success', company: null }
  }

  const company = await prisma.company.upsert({
    where: { userId },
    create: { ...body, userId },
    update: body,
  })

  await recordAudit(event, admin, {
    action: user.company ? 'admin.company.update' : 'admin.company.create',
    targetType: 'Company',
    targetId: company.id,
    metadata: { user: user.email, before: user.company, after: company },
  })

  return { status: 'success', company }
})
