import type { Company } from '~/data/site'
import { company as baseline } from '~/data/site'

/**
 * The company facts the site shows (ADR-021 §5): the code baseline in
 * `data/site.ts`, with any setting the panel has filled in laid over it.
 * A setting left empty keeps the baseline's value, so the site cannot lose
 * a fact to an untouched form; the standing "empty hides" rule applies to
 * the result exactly as before. One fetch per request, shared through the
 * payload.
 */
export interface SiteSettings extends Company {
  seoDefaultTitle: string
  seoDefaultDescription: string
  ogImage: { src: string, width: number | null, height: number | null, alt: string } | null
  siteUrl: string
}

const SOCIAL_KEYS: Record<string, keyof NonNullable<Awaited<ReturnType<typeof fetchSettingsShape>>>['social']> = { LinkedIn: 'linkedin', Instagram: 'instagram', X: 'x', YouTube: 'youtube' }

/** Type helper only. */
async function fetchSettingsShape() {
  return null as null | { social: { linkedin: string, instagram: string, x: string, youtube: string } }
}

function over(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback
}

export function useSiteSettings() {
  const { data } = useFetch<{ settings: any }>('/api/cms/settings', { key: 'cms:settings', default: () => ({ settings: null }), ignoreResponseError: true })
  return computed<SiteSettings>(() => {
    const s = data.value?.settings
    if (!s) {
      return { ...baseline, seoDefaultTitle: '', seoDefaultDescription: '', ogImage: null, siteUrl: '' }
    }
    return {
      ...baseline,
      name: over(s.name, baseline.name),
      tagline: over(s.tagline, baseline.tagline),
      email: over(s.email, baseline.email),
      phone: over(s.phone, baseline.phone),
      openingHours: over(s.openingHours, baseline.openingHours),
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
      social: baseline.social.map(profile => ({ ...profile, url: over(s.social?.[SOCIAL_KEYS[profile.label] ?? ''], profile.url) })),
      seoDefaultTitle: s.seo?.defaultTitle ?? '',
      seoDefaultDescription: s.seo?.defaultDescription ?? '',
      ogImage: s.seo?.ogImage ?? null,
      siteUrl: s.url ?? '',
    }
  })
}
