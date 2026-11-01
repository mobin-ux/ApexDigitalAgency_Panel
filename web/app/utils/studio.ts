import type { Company } from '../data/site'
import { company } from '../data/site'

/**
 * The studio's address as the About and Contact cards print it, and the links
 * built from it. Everything is empty until `site.ts` has a confirmed street
 * address, so neither card can show a made-up one or send anyone to it.
 */
export function studioFor(c: Company) {
  const { street, locality, region, postcode } = c.address
  return {
    addressLines: street ? [street, [`${locality}, ${region}`, postcode].filter(Boolean).join(' ')] : [],
    directionsUrl: street
      ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: [street, locality, postcode].filter(Boolean).join(', ') })}`
      : '',
    telHref: c.phone ? `tel:${c.phone.replace(/[^\d+]/g, '')}` : '',
  }
}

export const studio = studioFor(company)
