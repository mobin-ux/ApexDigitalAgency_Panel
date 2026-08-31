import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'

/**
 * DELETE /api/admin/team/invites/:id — withdraw an invitation.
 *
 * The row is stamped `cancelledAt` rather than deleted: the audit trail
 * refers to it, and a log whose subjects can vanish is not much of a log.
 * The token stops working immediately either way.
 */
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
    throw createError({ statusCode: 400, message: 'That invite has already been accepted. Change their role or suspend their access instead.' })
  }

  await prisma.staffInvite.update({ where: { id }, data: { cancelledAt: new Date() } })

  await recordAudit(event, admin, {
    action: 'admin.team.invite.cancel',
    targetType: 'StaffInvite',
    targetId: id,
    subject: invite.name,
    metadata: { email: invite.email },
  })

  return { status: 'success' }
})
