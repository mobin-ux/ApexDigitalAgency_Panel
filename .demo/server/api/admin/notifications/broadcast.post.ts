import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/notifications/broadcast — send an in-app notification
 * to one user or to every customer. In-app only: there is no mail
 * provider wired up (REQUIREMENTS §5 backlog), so this never pretends
 * to send email.
 */

const bodySchema = z.object({
  title: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(1000),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING']).default('INFO'),
  link: z.string().trim().max(300).regex(/^\//, 'Link must be an in-app path starting with /').nullable().optional(),
  // Omit userId to broadcast to every customer account.
  userId: z.string().trim().min(1).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'catalogue.edit')
  const { title, message, type, link, userId } = await validateBody(event, bodySchema)

  let recipients: string[]
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) {
      throw createError({ statusCode: 400, message: 'Recipient not found' })
    }
    recipients = [user.id]
  }
  else {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER', status: 'ACTIVE' },
      select: { id: true },
    })
    recipients = customers.map(u => u.id)
  }

  if (recipients.length === 0) {
    throw createError({ statusCode: 400, message: 'No recipients matched' })
  }

  await prisma.notification.createMany({
    data: recipients.map(id => ({ userId: id, title, message, type, link: link ?? null })),
  })

  await recordAudit(event, admin, {
    action: 'admin.notification.broadcast',
    targetType: 'Notification',
    metadata: { title, type, recipientCount: recipients.length, single: Boolean(userId) },
  })

  return { status: 'success', recipientCount: recipients.length }
})
