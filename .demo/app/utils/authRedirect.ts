import type { RouteLocationNormalized } from 'vue-router'

const HOME = '/dashboards/balance'

/**
 * Where to go after signing in or creating an account.
 *
 * The guards used to send a signed-out visitor to sign-in and forget why they
 * came, so "Start your order" on the marketing site (a link to the New Order
 * wizard with the service in the query) ended on the dashboard after sign-in,
 * with the choice gone. The destination now rides along as `?redirect=`.
 *
 * Only a path on this site is honoured. Anything else — another origin,
 * a protocol-relative `//host` or `/\host` (both of which browsers treat as
 * another origin), or a loop back into the auth pages — falls back to the
 * dashboard, so the parameter cannot be used to bounce someone off-site.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.startsWith('/auth')) {
    return HOME
  }
  return value
}

/** The sign-in route for a guard to send `to` to, remembering `to`. */
export function signInFor(to: RouteLocationNormalized) {
  const target = safeRedirect(to.fullPath)
  return target === HOME ? '/auth/login-1' : { path: '/auth/login-1', query: { redirect: target } }
}

/** `?redirect=` to carry between sign-in and sign-up, or none. */
export function redirectQuery(value: unknown) {
  const target = safeRedirect(value)
  return target === HOME ? {} : { redirect: target }
}
