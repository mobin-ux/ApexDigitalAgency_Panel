import { can, DEFAULT_STAFF_ROLE, isStaffRole } from '~~/shared/permissions'
import { adminSignInFor, homeFor } from '~/utils/adminNav'

/**
 * Route guard for /admin/** pages: a staff session plus a role gate.
 *
 * Only the staff sign-in (`/admin/sign-in`, ADR-025) makes a staff session,
 * so anyone without one is sent there, remembering where they were going.
 * A customer account holding a customer session is sent to its dashboard
 * rather than a 403 — the admin console simply doesn't exist for them.
 *
 * The Overview at /admin loads the work queue, which needs `work.view`. A
 * role without it is sent to the first screen its role can open instead of
 * a page whose only content is a 403.
 *
 * The session cookies are httpOnly, so this is decided by `fetchUser()`
 * (server-verified). It is UX only: every /api/admin/** endpoint re-checks
 * the session kind and the role against the database through `requireAdmin`.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useUser()

  if (!user.value) {
    await fetchUser()
  }

  if (user.value && user.value.role !== 'ADMIN') {
    return navigateTo('/dashboards/balance')
  }

  if (user.value?.sessionKind !== 'staff') {
    return navigateTo(adminSignInFor(to))
  }

  if (to.path === '/admin') {
    const role = isStaffRole(user.value.staffRole) ? user.value.staffRole : DEFAULT_STAFF_ROLE
    const home = homeFor(role)
    // A role that can open nothing stays here, where the access wall says so.
    if (!can(role, 'work.view') && home) {
      return navigateTo(home)
    }
  }
})
