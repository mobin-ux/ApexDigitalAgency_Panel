/**
 * Route guard for /admin/** pages: authentication plus a role gate.
 * Non-admin accounts are sent to their customer dashboard rather than a
 * 403 — the admin panel simply doesn't exist for them.
 *
 * The session cookie is httpOnly, so authentication is resolved through
 * `fetchUser()` (server-verified). The role check here is UX only; every
 * /api/admin/** endpoint re-verifies the role server-side against the
 * database via `requireAdmin`, so a tampered client cannot gain anything.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchUser } = useUser()

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
