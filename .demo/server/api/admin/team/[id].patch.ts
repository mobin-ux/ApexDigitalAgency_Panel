import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { DEFAULT_STAFF_ROLE, isStaffRole, ROLES, STAFF_ROLES } from '../../../../shared/permissions'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/team/:id — change a staff member's role, or suspend
 * and restore their access.
 *
 * The two refusals from badge 25 are enforced here, not only in the UI:
 * you cannot change or suspend your own access, and the last owner
 * cannot be demoted or suspended. Both answer 400 with the sentence the
 * screen shows in place of the buttons, so a hand-made request gets the
 * same explanation a person does.
 */

const bodySchema = z
  .object({
    staffRole: z.enum(STAFF_ROLES).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(data => data.staffRole !== undefined || data.status !== undefined, {
    message: 'Provide a role or a status change',
  })

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'team.manage')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Team member id is required' })
  }

  const { staffRole, status, reason } = await validateBody(event, bodySchema)

  const before = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, staffRole: true, status: true },
  })
  if (!before || before.role !== 'ADMIN') {
    throw createError({ statusCode: 404, message: 'Team member not found' })
  }

  if (id === admin.id) {
    throw createError({ statusCode: 400, message: 'You can\'t change your own access' })
  }

  const currentRole = isStaffRole(before.staffRole) ? before.staffRole : DEFAULT_STAFF_ROLE

  /*
   * An account with no owner cannot manage billing or restore access, so
   * the last owner is protected from both halves of this endpoint —
   * demotion and suspension.
   */
  if (currentRole === 'owner') {
    const owners = await prisma.user.count({ where: { role: 'ADMIN', staffRole: 'owner', status: 'ACTIVE' } })
    const losingOwner = (staffRole !== undefined && staffRole !== 'owner') || status === 'SUSPENDED'
    if (owners <= 1 && losingOwner) {
      throw createError({
        statusCode: 400,
        message: 'This is the last owner. Promote someone else to owner first — an account with no owner cannot manage billing or restore access.',
      })
    }
  }

  const after = await prisma.user.update({
    where: { id },
    data: {
      ...(staffRole === undefined ? {} : { staffRole }),
      ...(status === undefined ? {} : { status }),
    },
    select: { id: true, email: true, firstName: true, lastName: true, staffRole: true, status: true },
  })

  const subject = [before.firstName, before.lastName].filter(Boolean).join(' ') || before.email || id

  if (staffRole !== undefined && staffRole !== currentRole) {
    await recordAudit(event, admin, {
      action: 'admin.team.role',
      targetType: 'User',
      targetId: id,
      subject,
      reason,
      metadata: { from: ROLES[currentRole].label, to: ROLES[staffRole].label },
    })
  }
  if (status !== undefined && status !== before.status) {
    await recordAudit(event, admin, {
      action: status === 'SUSPENDED' ? 'admin.team.suspend' : 'admin.team.restore',
      targetType: 'User',
      targetId: id,
      subject,
      reason,
      metadata: { before: before.status, after: status },
    })
  }

  return after
})
