import { createError, defineEventHandler } from 'h3'
import { recordAudit } from '../../../utils/audit'
import { deliverNow, enqueueMail, loadBrand } from '../../../utils/mail/outbox'
import { absoluteUrl, MailRenderError } from '../../../utils/mail/render'
import { testMail } from '../../../utils/mail/templates'
import { MAIL_ENV_KEYS, mailConfigured, mailRuntime } from '../../../utils/mail/transport'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'

/**
 * POST /api/admin/mail/test — send a test email to the signed-in staff
 * member's own address, through the real outbox and the real provider.
 * Takes no body. The answer is the outbox row's outcome: SENT with the
 * provider's id, or the reason it was not.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'team.manage')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })

  if (!mailConfigured()) {
    throw createError({ statusCode: 409, message: `Mail is not configured. Set ${MAIL_ENV_KEYS.join(' and ')} and restart the panel.` })
  }
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { email: true, firstName: true } })
  if (!user?.email) {
    throw createError({ statusCode: 400, message: 'Your account has no email address to send a test to.' })
  }

  let panelUrl: string
  try {
    panelUrl = absoluteUrl('/admin/mail')
  }
  catch (error) {
    if (error instanceof MailRenderError) {
      throw createError({ statusCode: 409, message: error.message })
    }
    throw error
  }

  const brand = await loadBrand()
  const draft = testMail(brand, { name: user.firstName || 'there', from: mailRuntime().from, panelUrl })
  const { id } = await enqueueMail({ to: user.email, toUserId: actor.id, kind: 'test', ...draft })
  const [outcome] = await deliverNow([id])
  const result = outcome ?? { id, status: 'QUEUED' as const, error: null }

  await recordAudit(event, actor, {
    action: 'admin.mail.test',
    targetType: 'MailMessage',
    targetId: id,
    metadata: { to: user.email, result: result.status, error: result.error },
  })

  return { mail: result }
})
