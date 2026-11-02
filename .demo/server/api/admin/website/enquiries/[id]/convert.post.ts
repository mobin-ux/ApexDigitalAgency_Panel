import { createError, defineEventHandler, getRouterParam } from 'h3'
import { can } from '../../../../../../shared/permissions'
import { enquiryRef } from '../../../../../../shared/refs'
import { recordAudit } from '../../../../../utils/audit'
import { randomToken } from '../../../../../utils/crypto'
import { queueClientWelcomeMail, WELCOME_LINK_TTL_HOURS } from '../../../../../utils/mail/flows'
import { deliverNow } from '../../../../../utils/mail/outbox'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { enquiryDetail } from '../../../../../utils/website/enquiries'

/**
 * POST /api/admin/website/enquiries/:id/convert — "Convert to client"
 * (`v_43leads`): a portal account for the enquirer, and the enquiry marked
 * Won and linked to it. Needs `leads.handle` and `clients.approve`.
 *
 * The account has no usable password; the enquirer is emailed a link to
 * choose one (72 hours, then "Forgot password" works as for anyone). When
 * mail is not configured the account is still made and the answer says the
 * email did not go, so the screen can say so. Accounts are active from
 * signup on this platform, so there is no approval step to start.
 *
 * An address that already has a client account is linked rather than
 * duplicated, and nothing is emailed; one that belongs to a staff account
 * is refused. The enquiry's message and notes stay on the enquiry (staff
 * only): the client record's own notes are the customer's to edit, so
 * nothing is copied there.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'leads.handle')
  if (!can(actor.staffRole, 'clients.approve')) {
    // The same refusal the guard gives, for the second permission.
    await requireStaffPermission(event, 'clients.approve')
  }
  const id = getRouterParam(event, 'id') ?? ''
  const row = await prisma.enquiry.findUnique({ where: { id } })
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'This enquiry no longer exists.' })
  }
  if (row.clientId) {
    throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'This enquiry is already a client.' })
  }
  if (row.status === 'lost') {
    throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Reopen this enquiry before converting it.' })
  }

  const email = row.email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
  if (existing && existing.role !== 'CUSTOMER') {
    throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'This address belongs to a staff account, so it cannot become a client.' })
  }

  const now = new Date()
  const [firstName, ...rest] = row.name.trim().split(/\s+/)
  const result = await prisma.$transaction(async (tx) => {
    // Claimed first, so two people pressing Convert at once make one account.
    const claim = await tx.enquiry.updateMany({ where: { id, clientId: null, status: { not: 'lost' } }, data: { status: 'won', lostReason: null, convertedAt: now, convertedById: actor.id } })
    if (!claim.count) {
      throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Someone converted this enquiry a moment ago. Reload to see it.' })
    }
    if (existing) {
      await tx.enquiry.update({ where: { id }, data: { clientId: existing.id } })
      return { clientId: existing.id, linked: true, mailId: null as string | null }
    }
    const user = await tx.user.create({
      data: {
        email,
        // Not a bcrypt hash, so no password ever matches it: the emailed link sets one.
        password: `!unset:${randomToken(16)}`,
        firstName: firstName || null,
        lastName: rest.join(' ') || null,
        role: 'CUSTOMER',
        ...(row.business ? { company: { create: { name: row.business, email, phone: row.phone || null } } } : {}),
      },
      select: { id: true, email: true, firstName: true },
    })
    await tx.enquiry.update({ where: { id }, data: { clientId: user.id } })
    const token = randomToken(32)
    await tx.passwordResetToken.create({ data: { email, token, userId: user.id, expiresAt: new Date(now.getTime() + WELCOME_LINK_TTL_HOURS * 3_600_000) } })
    const mail = await queueClientWelcomeMail({ id: user.id, email, firstName: user.firstName }, token, tx)
    return { clientId: user.id, linked: false, mailId: mail.id }
  })

  const [outcome] = result.mailId ? await deliverNow([result.mailId]) : []
  await recordAudit(event, actor, {
    action: 'admin.website.enquiry.convert',
    targetType: 'Enquiry',
    targetId: id,
    subject: `${enquiryRef(id)} → ${result.linked ? 'linked to an existing client' : 'client account created'}`,
    metadata: { clientId: result.clientId, linked: result.linked },
  })
  const mail = result.mailId
    ? outcome ?? (await prisma.mailMessage.findUnique({ where: { id: result.mailId }, select: { id: true, status: true, lastError: true } }).then(m => m && { id: m.id, status: m.status, error: m.lastError }))
    : null
  return { ...(await enquiryDetail(id)), clientId: result.clientId, linked: result.linked, mail }
})
