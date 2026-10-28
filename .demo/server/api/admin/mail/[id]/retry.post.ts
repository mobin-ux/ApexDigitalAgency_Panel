import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../utils/audit'
import { DEAD_ON_RETRY, deliverNow, requeueMail } from '../../../../utils/mail/outbox'
import { mailConfigured } from '../../../../utils/mail/transport'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'

/**
 * POST /api/admin/mail/:id/retry — send a failed message again, now.
 *
 * Refused for a reset or verification email: its link died with its token,
 * so a retry would deliver a link that no longer works. The person asks for
 * a new one instead. Refused while mail is not configured, because the
 * retry would only fail again with the same reason.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'team.manage')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Message id is required' })
  }
  const row = await prisma.mailMessage.findUnique({ where: { id }, select: { id: true, kind: true, to: true, subject: true, status: true, attempts: true } })
  if (!row) {
    throw createError({ statusCode: 404, message: 'Message not found' })
  }
  if (row.status !== 'FAILED') {
    throw createError({ statusCode: 409, message: 'Only a failed email can be retried.' })
  }
  if (DEAD_ON_RETRY.has(row.kind)) {
    throw createError({ statusCode: 409, message: 'This link has expired with its token. The person has to ask for a new one.' })
  }
  if (!mailConfigured()) {
    throw createError({ statusCode: 409, message: 'Mail is not configured, so a retry would fail again.' })
  }

  await requeueMail(id)
  const [outcome] = await deliverNow([id])
  const result = outcome ?? { id, status: 'QUEUED' as const, error: null }

  await recordAudit(event, actor, {
    action: 'admin.mail.retry',
    targetType: 'MailMessage',
    targetId: id,
    subject: row.subject,
    metadata: { kind: row.kind, to: row.to, attempts: row.attempts, result: result.status },
  })

  return { mail: result }
})
