import type { ServiceSlug } from '~/data/routes'
import type { CtaTarget } from '~/data/service-pages/types'
import { routes } from '~/data/routes'

/**
 * Where a service page's calls to action go. Returns `{ to }` for links inside
 * the site and `{ href }` for the panel, ready to bind onto `<UiButton>`.
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

  function linkTo(target: CtaTarget): { to: string } | { href: string } {
    switch (target) {
      case 'plans':
        return { to: '#plans' }
      case 'work':
        return { to: '#work' }
      case 'contact':
        return { to: contact() }
      case 'order':
        return { href: panel.orderFor(slug) }
    }
  }

  return { contact, linkTo }
}
