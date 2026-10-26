import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/users/:id/two-factor-reset — turn off someone's two-step
 * verification when they have lost both their phone and their backup codes.
 * The way back in has to exist, and has to be a person's decision: it needs
 * `clients.approve`, a typed reason for the audit log, and never applies to
 * your own account. The customer is told in their notifications.
 */
const bodySchema = z.object({ reason: z.string().trim().min(5, 'Say how you confirmed it is them').max(500) }).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'clients.approve')
  const id = getRouterParam(event, 'id')!
  const { reason } = await validateBody(event, bodySchema)
  if (id === admin.id) {
    throw createError({ statusCode: 400, message: 'Ask another owner or admin to reset your own two-step verification.' })
  }
  const { count } = await prisma.twoFactor.deleteMany({ where: { userId: id, enabledAt: { not: null } } })
  if (!count) {
    throw createError({ statusCode: 404, message: 'Two-step verification is not on for this account.' })
  }
  await prisma.notification.create({
    data: {
      userId: id,
      title: 'Two-step verification was turned off',
      message: 'Our team turned it off at your request. Turn it on again in Settings › Security.',
      type: 'WARNING',
      link: '/dashboards/settings?section=security',
    },
  })
  await recordAudit(event, admin, { action: 'admin.user.two-factor.reset', targetType: 'User', targetId: id, reason })
  return { status: 'off' }
})
