/**
 * Route guard for authenticated customer pages.
 *
 * The session cookie is httpOnly, so this cannot (and must not) read it.
 * Authentication is decided by `fetchUser()`, which asks the server —
 * the only answer that was ever authoritative. The previous cookie
 * fast-path was pure UX: any string in `auth_token` satisfied it.
 *
 * `fetchUser()` uses `useRequestFetch()` so the incoming cookies are
 * forwarded during SSR; that is what keeps hard reloads signed in.
 */
export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchUser } = useUser()

  // Already hydrated from a previous navigation — no round trip needed.
  if (!user.value) {
    await fetchUser()
  }

  if (!user.value) {
    return navigateTo('/auth/login-1')
  }
})
