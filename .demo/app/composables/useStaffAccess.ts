import type { Permission, RoleDef, StaffRole } from '~~/shared/permissions'
import { can as canDo, DEFAULT_STAFF_ROLE, isStaffRole, PERMISSIONS, ROLES, rolesWith } from '~~/shared/permissions'

/**
 * The signed-in staff member's role and what it allows (Phase 9 Admin).
 *
 * Reads the same `shared/permissions.ts` table the server enforces, so
 * the sidebar's padlocks, the blocked-page wall and the role matrix all
 * answer from the object that decides the 403 (badge 26). Nothing here
 * is a security control — every endpoint re-checks against the database
 * — it decides what is worth rendering.
 */
export function useStaffAccess() {
  const { user } = useUser()

  /**
   * Falls back to `owner` for an admin account with no `staffRole` yet,
   * matching the server's own fallback. Anything that is not staff at all
   * gets null, and `can()` then answers false for everything.
   */
  const role = computed<StaffRole | null>(() => {
    const value = user.value?.staffRole
    if (isStaffRole(value)) {
      return value
    }
    return user.value?.role === 'ADMIN' ? DEFAULT_STAFF_ROLE : null
  })

  const roleDef = computed<RoleDef | null>(() => (role.value ? ROLES[role.value] : null))

  function can(permission: Permission): boolean {
    return canDo(role.value, permission)
  }

  return { role, roleDef, can, PERMISSIONS, ROLES, rolesWith }
}
