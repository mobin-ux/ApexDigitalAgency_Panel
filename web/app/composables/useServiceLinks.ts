import type { ServiceSlug } from '~/data/routes'
import type { CtaTarget } from '~/data/service-pages/types'
import { routes } from '~/data/routes'

/**
 * Where a service page's calls to action go, as `{ to }` ready to bind onto
 * `<UiButton>`. Orders start on the contact form with the service named.
 */
export function useServiceLinks(slug: ServiceSlug) {
  /** The contact form with the service (and optionally a plan) named. */
  function contact(plan?: string) {
    const query = new URLSearchParams({ service: slug })
    if (plan) {
      query.set('plan', plan)
    }
    return `${routes.contact}?${query}`
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

  return { contact, linkTo }
}
