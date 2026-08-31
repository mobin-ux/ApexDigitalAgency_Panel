import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { ROLES, STAFF_ROLES } from '../../../../../shared/permissions'
import { recordAudit } from '../../../../utils/audit'
import { randomToken } from '../../../../utils/crypto'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/team/invites — invite someone to the staff panel.
 *
 * Creating the row grants nothing: the invited person has no access
 * until they accept it and a User record exists (badge 24). The token is
 * single-use and expires in 7 days.
 *
 * There is no mail provider in this stack, so nothing is emailed. The
 * acceptance link is returned to the caller and the panel tells the
 * operator to pass it on themselves — a screen that claimed "invite
 * sent" while no message left the building would be the same defect
 * Phase 6 removed from the support composer.
 */

const INVITE_TTL_DAYS = 7

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Enter their full name').max(100),
  email: z.string().trim().toLowerCase().email('That doesn\'t look like an email address').max(200),
  role: z.enum(STAFF_ROLES),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'team.manage')
  const { name, email, role } = await validateBody(event, bodySchema)

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
  if (existingUser) {
    throw createError({
      statusCode: 409,
      message: existingUser.role === 'ADMIN'
        ? 'That address is already a team member.'
        : 'That address already has a client account. Use a different work address.',
    })
  }

  const pending = await prisma.staffInvite.findFirst({
    where: { email, acceptedAt: null, cancelledAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  })
  if (pending) {
    throw createError({ statusCode: 409, message: 'That address already has an invite waiting. Resend or cancel it instead.' })
  }

  const token = randomToken(32)
  const invite = await prisma.staffInvite.create({
    data: {
      name,
      email,
      role,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      invitedById: admin.id,
    },
    select: { id: true, name: true, email: true, role: true, expiresAt: true, sentAt: true, createdAt: true },
  })

  await recordAudit(event, admin, {
    action: 'admin.team.invite',
    targetType: 'StaffInvite',
    targetId: invite.id,
    subject: name,
    metadata: { email, role: ROLES[role].label },
  })

  return { invite, acceptUrl: `/auth/accept-invite?token=${token}` }
})
