import { company } from '../data/site'

const { street, locality, region, postcode } = company.address

/**
 * The studio's address as the About and Contact cards print it, and the links
 * built from it. Everything is empty until `site.ts` has a confirmed street
 * address, so neither card can show a made-up one or send anyone to it.
 */
export const studio = {
  addressLines: street ? [street, [`${locality}, ${region}`, postcode].filter(Boolean).join(' ')] : [],
  directionsUrl: street
    ? `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: [street, locality, postcode].filter(Boolean).join(', ') })}`
    : '',
  telHref: company.phone ? `tel:${company.phone.replace(/[^\d+]/g, '')}` : '',
} as const
