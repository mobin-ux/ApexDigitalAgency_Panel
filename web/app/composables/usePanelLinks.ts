import type { ServiceSlug } from '~/data/routes'

/**
 * The panel's New Order wizard names services by its own keys and reads them
 * from `?service=` (see `QUERY_MAP` in the panel's dashboards/services.vue).
 */
const panelServiceKey: Record<ServiceSlug, string> = {
  'website-design': 'web',
  'software-development': 'dev',
  'digital-marketing': 'marketing',
  'seo': 'seo',
  'ppc': 'marketing',
  'ui-ux-design': 'uiux',
  'branding': 'branding',
}

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
    /**
     * New Order with the service preselected. `plan` and `term` are passed
     * for the wizard to preselect too; today it reads only `service`.
     */
    orderFor(service: ServiceSlug, options: { plan?: string, term?: number } = {}) {
      const query = new URLSearchParams({ service: panelServiceKey[service] })
      if (options.plan) {
        query.set('plan', options.plan)
      }
      if (options.term) {
        query.set('term', String(options.term))
      }
      return `${base}/dashboards/services?${query}`
    },
  }
}
