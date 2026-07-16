/**
 * Route guard for /admin/** pages. Same flow as the `auth` middleware
 * (cookie fast-path, then a server-verified fetchUser) plus a role gate:
 * non-admin accounts are sent to their customer dashboard, never to a
 * 403 page — the admin panel simply doesn't exist for them.
 *
 * The client-side role check is UX only; every /api/admin/** endpoint
 * re-verifies the role server-side (DB-fresh) via requireAdmin.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchUser } = useUser()

  const token = useCookie('auth_token')
  if (!token.value) {
    return navigateTo('/auth/login-1')
  }

  if (!user.value) {
    await fetchUser()
  }

  if (!user.value) {
    return navigateTo('/auth/login-1')
  }

  if (user.value.role !== 'ADMIN') {
    return navigateTo('/dashboards/balance')
  }
})
