import { can, isStaffRole } from '../../shared/permissions'
import prisma from './prisma'

/**
 * Who may own project work.
 *
 * The design's assign dialog says "only staff whose role can own project
 * work are listed", and the row that decides it is `work.assign` in the
 * permission matrix — the same one `PATCH /api/admin/projects/:id` is
 * gated on, so the picker cannot offer somebody the endpoint would then
 * refuse.
 *
 * `EMPLOYEE` accounts have no staff role: ADR-016 keeps that enum as the
 * project-assignment label with no panel access, which makes them
 * assignable by definition. An `ADMIN` qualifies when their staff role
 * holds the permission, defaulting to `owner` exactly as the server guard
 * does for a row that predates the column.
 */
export async function assignableStaff() {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'EMPLOYEE'] }, status: { not: 'SUSPENDED' } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      staffRole: true,
      _count: { select: { managedProjects: true } },
    },
    orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
  })

  return staff
    .filter(s => s.role === 'EMPLOYEE' || can(isStaffRole(s.staffRole) ? s.staffRole : 'owner', 'work.assign'))
    .map(s => ({
      id: s.id,
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role,
      staffRole: s.staffRole,
      /** Projects they currently manage — the design's "4 projects" line. */
      load: s._count.managedProjects,
    }))
}
