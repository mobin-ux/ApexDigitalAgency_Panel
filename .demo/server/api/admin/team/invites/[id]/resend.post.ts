import { createError, defineEventHandler, getRouterParam } from 'h3'
import { ROLES } from '../../../../../../shared/permissions'
import { recordAudit } from '../../../../../utils/audit'
import { randomToken } from '../../../../../utils/crypto'
import { queueInviteMail } from '../../../../../utils/mail/flows'
import { deliverNow } from '../../../../../utils/mail/outbox'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { staffName } from '../../../../../utils/support'

/**
 * POST /api/admin/team/invites/:id/resend — issue a fresh link.
 *
 * "Resend" mints a NEW token and restarts the 7-day clock, which
 * invalidates the previous link. That is the point: an invite forwarded
 * to the wrong address stops working the moment it is resent. The new
 * link is emailed through the outbox (ADR-022) and also returned, with
 * `mail.status`, so the operator can pass it on when the email did not go.
 */

const INVITE_TTL_DAYS = 7

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'team.manage')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Invite id is required' })
  }

  const invite = await prisma.staffInvite.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, acceptedAt: true, cancelledAt: true },
  })
  if (!invite || invite.cancelledAt) {
    throw createError({ statusCode: 404, message: 'Invite not found' })
  }
  if (invite.acceptedAt) {
    throw createError({ statusCode: 400, message: 'That invite has already been accepted.' })
  }

  const token = randomToken(32)
  const inviter = await prisma.user.findUnique({ where: { id: admin.id }, select: { firstName: true, lastName: true } })
  const roleLabel = ROLES[invite.role as keyof typeof ROLES]?.label ?? invite.role
  const { updated, mailId } = await prisma.$transaction(async (tx) => {
    const row = await tx.staffInvite.update({
      where: { id },
      data: {
        token,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true, expiresAt: true, sentAt: true },
    })
    const queued = await queueInviteMail({ name: invite.name, email: invite.email, roleLabel, expiresAt: row.expiresAt }, staffName(inviter) || 'A colleague', token, tx)
    return { updated: row, mailId: queued.id }
  })
  const [outcome] = await deliverNow([mailId])
  const mail = outcome ?? { id: mailId, status: 'QUEUED' as const, error: null }

  await recordAudit(event, admin, {
    action: 'admin.team.invite.resend',
    targetType: 'StaffInvite',
    targetId: id,
    subject: invite.name,
    metadata: { email: invite.email, mailStatus: mail.status },
  })

  return { invite: updated, acceptUrl: `/auth/accept-invite?token=${token}`, mail }
})
