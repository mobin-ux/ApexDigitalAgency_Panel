import type { H3Event } from 'h3'
import type { Permission, StaffRole } from '../../shared/permissions'
import type { AuthSession } from './auth'
import { createError } from 'h3'
import { can, DEFAULT_STAFF_ROLE, isStaffRole, ROLES, rolesWith } from '../../shared/permissions'
import { requireAdmin } from './auth'
import prisma from './prisma'

/**
 * Server-side enforcement of the staff permission matrix (Phase 9 Admin).
 *
 * `requireAdmin` answers "can this account reach the admin panel at all"
 * — the `Role` enum, unchanged. This adds the second question: "and is
 * this particular action within their staff role". Both are checked
 * against the database on every call, never against the 7-day JWT, so a
 * demotion takes effect on the next request rather than the next login.
 *
 * The matrix itself lives in `shared/permissions.ts`, which the admin UI
 * also imports — one table, so a tick on the role matrix and a 403 from
 * an endpoint cannot say different things.
 *
 * Backwards compatibility: every account that could already reach the
 * panel is backfilled to `owner`, and any row without a `staffRole`
 * falls back to `owner` here too. Retrofitting this guard onto the
 * existing routes is therefore behaviour-identical until someone is
 * deliberately given a narrower role.
 */

export interface StaffSession extends AuthSession {
  staffRole: StaffRole
}

/** The staff role stored on an account, or the `owner` fallback. */
export async function staffRoleOf(userId: string): Promise<StaffRole> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { staffRole: true } })
  return isStaffRole(user?.staffRole) ? user.staffRole : DEFAULT_STAFF_ROLE
}

/**
 * Admin-panel access plus one specific permission, or a 403 that names
 * the roles which do hold it — the same sentence the blocked-page wall
 * shows, so the API and the UI explain a refusal identically.
 */
export async function requireStaffPermission(event: H3Event, permission: Permission): Promise<StaffSession> {
  const session = await requireAdmin(event)
  const staffRole = await staffRoleOf(session.id)

  if (!can(staffRole, permission)) {
    const labels = rolesWith(permission).map(r => r.label)
    // "Owner", "Owner or Admin", "Owner, Admin or Finance" — a bare join
    // gave "Owner or Admin or Finance" once three roles held a permission.
    const allowed = labels.length > 1
      ? `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`
      : labels.join('')
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: `Your role (${ROLES[staffRole].label}) cannot do this. ${allowed} can.`,
      data: { permission, staffRole, allowedRoles: rolesWith(permission).map(r => r.key) },
    })
  }

  return { ...session, staffRole }
}

/** Admin-panel access with the staff role resolved, but no permission gate. */
export async function requireStaff(event: H3Event): Promise<StaffSession> {
  const session = await requireAdmin(event)
  return { ...session, staffRole: await staffRoleOf(session.id) }
}
