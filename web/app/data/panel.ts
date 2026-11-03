import type { ServiceSlug } from './routes'

/**
 * The client panel (panel.apexdigi.co.uk): where a client signs in, opens an
 * account and places an order. Its address is deployment config
 * (NUXT_PUBLIC_PANEL_URL, read by `usePanelLinks()`), so only the paths and
 * the words live here. With no address every panel link is left out and the
 * plan buttons open Contact instead.
 */

export const panelPaths = {
  logIn: '/auth/login-1',
  signUp: '/auth/signup-2',
  newOrder: '/dashboards/services',
} as const

export const panelLabels = {
  logIn: 'Log in',
  signUp: 'Sign up',
  footerHeading: 'Client panel',
  footerLogIn: 'Log in',
  footerSignUp: 'Create an account',
  footerOrder: 'Start an order',
} as const

/** The panel's catalogue names each service by a short id (`.demo/shared/catalog.ts`). */
const PANEL_SERVICE: Record<ServiceSlug, string> = {
  'website-design': 'web',
  'software-development': 'soft',
  'digital-marketing': 'mkt',
  'seo': 'seo',
  'ppc': 'ppc',
  'ui-ux-design': 'uiux',
  'branding': 'brand',
}

/** Plan ids the panel's catalogue spells differently from `plans.ts`. */
const PANEL_PLAN: Partial<Record<string, string>> = {
  'multi-channel': 'multi',
  'brand-web': 'brandweb',
}

/**
 * The panel's New order wizard with a service (and a plan) chosen. A
 * signed-out visitor is sent to sign in, or to sign up, and arrives here after.
 */
export function panelOrderPath(service: ServiceSlug, plan?: string): string {
  const query = new URLSearchParams({ service: PANEL_SERVICE[service] })
  if (plan) {
    query.set('plan', PANEL_PLAN[plan] ?? plan)
  }
  return `${panelPaths.newOrder}?${query}`
}

/** The panel's origin from config, or '' when it is unset or not an http(s) address. */
export function panelOrigin(raw: unknown): string {
  if (typeof raw !== 'string') {
    return ''
  }
  const value = raw.trim().replace(/\/+$/, '')
  return /^https?:\/\/[^/\s]+$/.test(value) ? value : ''
}
