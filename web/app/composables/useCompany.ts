import type { Company } from '~/data/site'
import { company as baseline } from '~/data/site'

/**
 * The company facts the site shows (ADR-026): the code baseline in
 * `data/site.ts` with Site settings from the admin console laid over it.
 * A setting left empty keeps the baseline's value, so an untouched form
 * cannot erase a fact, and the standing rule still applies to the result:
 * an empty fact hides the thing it would have shown.
 *
 * The settings arrive with the site chrome in `middleware/cms.global.ts`,
 * in shared state, so every component reads one answer per request.
 */
export interface CmsSettingsLike {
  name: string
  legalName: string
  email: string
  phone: string
  companyNumber: string
  vatNumber: string
  icoNumber: string
  address: { street: string, locality: string, region: string, postcode: string }
  social: { linkedin: string, instagram: string, x: string, youtube: string }
  ogImage: { src: string, width: number | null, height: number | null, alt: string } | null
  maintenance: boolean
}

export function useCmsSettingsState() {
  return useState<CmsSettingsLike | null>('cms-settings', () => null)
}

const SOCIAL: Record<string, keyof CmsSettingsLike['social']> = { LinkedIn: 'linkedin', Instagram: 'instagram', X: 'x', YouTube: 'youtube' }

function over(value: string | undefined, fallback: string): string {
  return value?.trim() ? value.trim() : fallback
}

/** Baseline facts with the settings that are filled in laid over them. */
export function companyWith(s: CmsSettingsLike | null): Company {
  if (!s) {
    return baseline
  }
  return {
    ...baseline,
    name: over(s.name, baseline.name),
    legalName: over(s.legalName, baseline.legalName),
    email: over(s.email, baseline.email),
    phone: over(s.phone, baseline.phone),
    companyNumber: over(s.companyNumber, baseline.companyNumber),
    vatNumber: over(s.vatNumber, baseline.vatNumber),
    icoNumber: over(s.icoNumber, baseline.icoNumber),
    address: {
      ...baseline.address,
      street: over(s.address?.street, baseline.address.street),
      locality: over(s.address?.locality, baseline.address.locality),
      region: over(s.address?.region, baseline.address.region),
      postcode: over(s.address?.postcode, baseline.address.postcode),
    },
    social: baseline.social.map(profile => ({ ...profile, url: over(s.social?.[SOCIAL[profile.label] ?? 'linkedin'], profile.url) })),
  }
}

export function useCompany() {
  const settings = useCmsSettingsState()
  return computed(() => companyWith(settings.value))
}
