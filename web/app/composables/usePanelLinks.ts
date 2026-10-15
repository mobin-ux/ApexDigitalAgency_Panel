/**
 * Links into the customer panel (a separate Nuxt app on its own subdomain).
 * The base URL comes from `NUXT_PUBLIC_PANEL_URL`, so staging and production
 * each point at their own panel without a code change.
 */
export function usePanelLinks() {
  const base = useRuntimeConfig().public.panelUrl.replace(/\/$/, '')

  return {
    login: `${base}/auth/login-1`,
    signup: `${base}/auth/signup-2`,
    dashboard: `${base}/dashboards/balance`,
    newOrder: `${base}/dashboards/services`,
  }
}
