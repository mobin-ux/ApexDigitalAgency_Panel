import type { ServiceSlug } from '~/data/routes'
import type { CtaTarget } from '~/data/service-pages/types'
import { routes } from '~/data/routes'

/**
 * Where a service page's calls to action go, as `{ to }` ready to bind onto
 * `<UiButton>`. A plan's order opens the client panel's New order with the
 * plan chosen; questions and calls go to the contact form.
 */
export function useServiceLinks(slug: ServiceSlug) {
  const panel = usePanelLinks()

  /** The contact form with the service (and optionally a plan) named. */
  function contact(plan?: string) {
    const query = new URLSearchParams({ service: slug })
    if (plan) {
      query.set('plan', plan)
    }
    return `${routes.contact}?${query}`
  }

  /** Ordering a plan: the panel when it is configured, else the contact form. */
  function order(plan: string) {
    return panel.order(slug, plan) || contact(plan)
  }

  function linkTo(target: CtaTarget): { to: string } {
    switch (target) {
      case 'plans':
        return { to: '#plans' }
      case 'work':
        return { to: '#work' }
      case 'contact':
        return { to: contact() }
    }
  }

  return { contact, order, linkTo }
}
