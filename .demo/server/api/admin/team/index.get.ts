import { defineEventHandler } from 'h3'
import { DEFAULT_STAFF_ROLE, isStaffRole } from '../../../../shared/permissions'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/team — everyone who can act inside the admin panel, plus
 * the invitations that have not been accepted yet.
 *
 * Members and invites are returned as two separate lists on purpose
 * (badge 24): an invited person has no access until they accept, so
 * folding them into one table would inflate the headcount and make them
 * look like people who can already act.
 *
 * "Staff" means `role: ADMIN` — the accounts the panel gate lets in.
 * `staffRole` then decides what they can do once inside. EMPLOYEE
 * accounts are a project-assignment label in the data model and have
 * never had panel access; this endpoint deliberately does not change
 * that.
 */

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'team.manage')

  const members = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      staffRole: true,
      staffJoinedAt: true,
      status: true,
      createdAt: true,
      _count: { select: { managedProjects: true } },
    },
  })

  /*
   * "Last active" in the mockup has no column behind it — nothing here
   * records a sign-in. What does exist is the audit trail, so the list
   * reports each member's most recent *recorded action*, which is a fact
   * the database can answer, and says so in the column heading. Inventing
   * "Active now" from `updatedAt` would be a fabricated security signal
   * of exactly the kind Phase 7 removed from the sessions list.
   */
  const lastActions = await prisma.auditLog.groupBy({
    by: ['actorId'],
    where: { actorId: { in: members.map(m => m.id) } },
    _max: { createdAt: true },
  })
  const lastActionBy = new Map(lastActions.map(row => [row.actorId, row._max.createdAt]))

  const invites = await prisma.staffInvite.findMany({
    where: { acceptedAt: null, cancelledAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      expiresAt: true,
      sentAt: true,
      createdAt: true,
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const normalised = members.map(m => ({
    ...m,
    staffRole: isStaffRole(m.staffRole) ? m.staffRole : DEFAULT_STAFF_ROLE,
    lastActionAt: lastActionBy.get(m.id) ?? null,
    isYou: m.id === admin.id,
  }))

  return {
    members: normalised,
    invites,
    ownerCount: normalised.filter(m => m.staffRole === 'owner').length,
    /** Who is asking — the client needs it to refuse self-edits in place. */
    viewer: { id: admin.id, staffRole: admin.staffRole },
  }
})
