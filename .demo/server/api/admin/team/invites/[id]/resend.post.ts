import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../../utils/audit'
import { randomToken } from '../../../../../utils/crypto'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'

/**
 * POST /api/admin/team/invites/:id/resend — issue a fresh link.
 *
 * "Resend" mints a NEW token and restarts the 7-day clock, which
 * invalidates the previous link. That is the point: an invite forwarded
 * to the wrong address stops working the moment it is resent. Nothing is
 * emailed (no mail provider), so the new link comes back in the response
 * for the operator to pass on.
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
    select: { id: true, name: true, email: true, acceptedAt: true, cancelledAt: true },
  })
  if (!invite || invite.cancelledAt) {
    throw createError({ statusCode: 404, message: 'Invite not found' })
  }
  if (invite.acceptedAt) {
    throw createError({ statusCode: 400, message: 'That invite has already been accepted.' })
  }

  const token = randomToken(32)
  const updated = await prisma.staffInvite.update({
    where: { id },
    data: {
      token,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    select: { id: true, expiresAt: true, sentAt: true },
  })

  await recordAudit(event, admin, {
    action: 'admin.team.invite.resend',
    targetType: 'StaffInvite',
    targetId: id,
    subject: invite.name,
    metadata: { email: invite.email },
  })

  return { invite: updated, acceptUrl: `/auth/accept-invite?token=${token}` }
})
