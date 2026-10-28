import type { InferMap } from './fields.ts'
import { f, mapToZod } from './fields.ts'

/**
 * The SEO object every page document carries, and how three layers of it
 * combine: the page's own values win, then the template's defaults, then
 * the site-wide defaults from settings. An empty string means "not set
 * here, ask the next layer", which is why nothing is required.
 */

export const ROBOTS_OPTIONS = [
  { value: 'index,follow', label: 'Index and follow links (normal)' },
  { value: 'noindex,follow', label: 'Hide from search, follow links' },
  { value: 'noindex,nofollow', label: 'Hide from search, ignore links' },
] as const

export type RobotsValue = typeof ROBOTS_OPTIONS[number]['value']

export const seoFields = {
  title: f.text({ label: 'Search title', hint: 'Shown as the tab and the search result. The site name is added after it.', max: 70 }),
  description: f.textarea({ label: 'Search description', hint: 'One or two sentences; Google shows about 155 characters.', max: 160 }),
  canonical: f.text({ label: 'Canonical address', hint: 'Only when this page is a copy of another. Leave empty for its own address.', max: 512, format: 'path-or-https' }),
  robots: f.select({ label: 'Search engines', options: ROBOTS_OPTIONS }),
  ogTitle: f.text({ label: 'Social title', hint: 'Used when the page is shared. Empty uses the search title.', max: 90 }),
  ogDescription: f.textarea({ label: 'Social description', max: 200 }),
  ogImage: f.optional(f.media({ label: 'Social image', hint: '1200 × 630 works everywhere.', accept: ['image'] })),
} as const

export const seoField = f.object({ label: 'SEO', fields: seoFields })

export const seoSchema = mapToZod(seoFields)

export type SeoValue = InferMap<typeof seoFields>

export const EMPTY_SEO: SeoValue = {
  title: '',
  description: '',
  canonical: '',
  robots: 'index,follow',
  ogTitle: '',
  ogDescription: '',
  ogImage: undefined,
}

export interface ResolvedSeo {
  title: string
  description: string
  canonical: string
  robots: RobotsValue
  ogTitle: string
  ogDescription: string
  ogImage: SeoValue['ogImage']
  noindex: boolean
}

function first(...values: (string | undefined)[]): string {
  return values.find(v => typeof v === 'string' && v.trim() !== '')?.trim() ?? ''
}

/**
 * Precedence: page → template default → site default. `robots` is the one
 * value that is never inherited upward from the site: a page's own choice
 * stands, and a page that says nothing is indexable.
 */
export function resolveSeo(page?: Partial<SeoValue> | null, template?: Partial<SeoValue> | null, site?: Partial<SeoValue> | null): ResolvedSeo {
  const title = first(page?.title, template?.title, site?.title)
  const description = first(page?.description, template?.description, site?.description)
  const robots = page?.robots ?? template?.robots ?? 'index,follow'
  return {
    title,
    description,
    canonical: first(page?.canonical, template?.canonical),
    robots,
    ogTitle: first(page?.ogTitle, title),
    ogDescription: first(page?.ogDescription, description),
    ogImage: page?.ogImage ?? template?.ogImage ?? site?.ogImage,
    noindex: robots.startsWith('noindex'),
  }
}
