import type { InferMap } from './fields.ts'
import type { Section } from './sections.ts'
import type { SeoValue } from './seo.ts'
import type { TemplateKey } from './templates.ts'
import { z } from 'zod'
import { f, mapToZod } from './fields.ts'
import { normalisePath } from './links.ts'
import { sectionsSchema } from './sections.ts'
import { EMPTY_SEO, seoSchema } from './seo.ts'
import { TEMPLATES } from './templates.ts'
import { validateContent } from './validate.ts'

/**
 * What the console's Website screens manage (ADR-026), and the two kinds of
 * document behind them:
 *
 * - **Coded**: a page the site already renders from a hand-built
 *   component (the homepage, a service page, the cost guide …). Its
 *   template in `templates.ts` / `pages.ts` says which words can change;
 *   its layout cannot.
 * - **Built**: a page, article or case study made in the console from the
 *   section types in `sections.ts`. The site renders its sections in order.
 *
 * Both are `SiteDocument` rows in the panel; `template` tells them apart.
 */

export type Collection = 'pages' | 'insights' | 'work' | 'chrome'

export const BUILT_TEMPLATES = ['built-page', 'built-article', 'built-case-study'] as const

export type BuiltTemplate = typeof BUILT_TEMPLATES[number]

export type DocumentTemplate = TemplateKey | BuiltTemplate

export function isBuiltTemplate(value: unknown): value is BuiltTemplate {
  return typeof value === 'string' && (BUILT_TEMPLATES as readonly string[]).includes(value)
}

export function isDocumentTemplate(value: unknown): value is DocumentTemplate {
  return isBuiltTemplate(value) || (typeof value === 'string' && value in TEMPLATES)
}

const COLLECTION_OF: Record<DocumentTemplate, Collection> = {
  'home': 'pages',
  'services': 'pages',
  'our-work': 'pages',
  'insights': 'pages',
  'about': 'pages',
  'contact': 'pages',
  'service': 'pages',
  'built-page': 'pages',
  'article': 'insights',
  'built-article': 'insights',
  'case-study': 'work',
  'built-case-study': 'work',
  'header': 'chrome',
  'footer': 'chrome',
  'announcement': 'chrome',
  'service-chrome': 'chrome',
  'case-study-chrome': 'chrome',
  'article-chrome': 'chrome',
}

/** Every template a stored document may have; anything else is a leftover the site never serves. */
export const DOCUMENT_TEMPLATES = Object.keys(COLLECTION_OF) as DocumentTemplate[]

export function collectionOf(template: DocumentTemplate): Collection {
  return COLLECTION_OF[template]
}

/** The templates a collection lists. */
export function templatesIn(collection: Collection): DocumentTemplate[] {
  return (Object.keys(COLLECTION_OF) as DocumentTemplate[]).filter(t => COLLECTION_OF[t] === collection)
}

/** The "Type" column of the Pages list. */
export function documentTypeLabel(template: DocumentTemplate): string {
  if (template === 'service') {
    return 'Service page'
  }
  if (template === 'built-page') {
    return 'Page'
  }
  if (isBuiltTemplate(template)) {
    return template === 'built-article' ? 'Article' : 'Case study'
  }
  return TEMPLATES[template].kind === 'global' ? 'Site chrome' : 'Page'
}

/** The categories an article can be filed under (the site's Insights topics). */
export const ARTICLE_CATEGORIES = [
  { value: 'websites', label: 'Websites' },
  { value: 'seo', label: 'SEO' },
  { value: 'ppc', label: 'Paid ads' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'software', label: 'Software' },
  { value: 'ux', label: 'UX' },
  { value: 'branding', label: 'Branding' },
] as const

const BUILT_META = {
  'built-page': {},
  'built-article': {
    category: f.select({ label: 'Category', options: ARTICLE_CATEGORIES }),
    readMinutes: f.number({ label: 'Reading time (minutes)', min: 1, max: 60, integer: true }),
    summary: f.textarea({ label: 'Summary', hint: 'Shown on the Insights list.', max: 300, required: true }),
  },
  'built-case-study': {
    sector: f.text({ label: 'Sector and place', hint: 'e.g. Trades, Kent', max: 80, required: true }),
    service: f.text({ label: 'Service', hint: 'e.g. Branding + website', max: 80, required: true }),
    summary: f.textarea({ label: 'Summary', hint: 'Shown on the Our work list.', max: 300, required: true }),
  },
} as const

export const BUILT_META_FIELDS = BUILT_META

export type BuiltMeta<T extends BuiltTemplate> = InferMap<typeof BUILT_META[T]>

export interface BuiltContent<T extends BuiltTemplate = BuiltTemplate> {
  sections: Section[]
  seo: SeoValue
  meta: BuiltMeta<T>
}

export function builtContentSchema(template: BuiltTemplate) {
  return z.object({
    sections: sectionsSchema,
    seo: seoSchema,
    meta: mapToZod(BUILT_META[template]),
  })
}

/** Check a document's content against its template, whichever kind it is. */
export function validateDocumentContent(template: DocumentTemplate, content: unknown): { ok: true, content: unknown } | { ok: false, issues: { path: string, message: string }[] } {
  if (isBuiltTemplate(template)) {
    const parsed = builtContentSchema(template).safeParse(content)
    return parsed.success
      ? { ok: true, content: parsed.data }
      : { ok: false, issues: parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }
  }
  return validateContent(template, content)
}

/** The seo object of a document's content, whichever kind it is. */
export function seoOf(content: unknown): SeoValue {
  const seo = (content as { seo?: SeoValue } | null)?.seo
  return seo ?? EMPTY_SEO
}

// ---------------------------------------------------------------- addresses

/**
 * First path segments a built page may not take: the site's own routes and
 * files. `/legal/*` and `/careers` are not among them: the footer links to
 * them and the site has no code for them, so the business publishes them
 * here, in its own words (docs/audit AUD-01).
 */
const RESERVED = new Set(['services', 'our-work', 'insights', 'about', 'contact', 'api', '_nuxt', '_ipx', 'media', 'preview', 'admin', 'portal', 'fonts', 'brand', 'img', 'icons', '__sitemap__', 'sitemap.xml', 'robots.txt', 'favicon.ico'])

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Where a new built document of `template` may live, or why it may not. */
export function checkBuiltPath(template: BuiltTemplate, raw: string): { ok: true, path: string } | { ok: false, message: string } {
  const path = normalisePath(raw)
  const segments = path.split('/').filter(Boolean)
  if (template === 'built-article' || template === 'built-case-study') {
    const prefix = template === 'built-article' ? 'insights' : 'our-work'
    if (segments.length !== 2 || segments[0] !== prefix || !SLUG.test(segments[1]!)) {
      return { ok: false, message: `The address must be /${prefix}/ and a slug of lower-case words joined by hyphens.` }
    }
    return { ok: true, path }
  }
  if (segments.length === 0) {
    return { ok: false, message: 'The homepage already exists.' }
  }
  if (segments.length > 3 || !segments.every(s => SLUG.test(s))) {
    return { ok: false, message: 'Use up to three lower-case words or numbers joined by hyphens, such as /pay-monthly.' }
  }
  if (RESERVED.has(segments[0]!)) {
    return { ok: false, message: `/${segments[0]} belongs to a page the site already has.` }
  }
  return { ok: true, path }
}

/** A slug from a title, for the address a new document suggests. */
export function slugify(title: string): string {
  return title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
}

// ---------------------------------------------------------------- workflow

/** `SiteDocument.status`: what the site serves. */
export type DocumentStatus = 'DRAFT' | 'PUBLISHED'

/** `SiteDocument.review`: where the working draft stands. */
export type ReviewState = 'NONE' | 'IN_REVIEW'

/** The design's status chip: one label and tone per state. */
export function statusChip(status: DocumentStatus, review: ReviewState, dirty: boolean): { key: 'draft' | 'review' | 'published' | 'changed', label: string, tone: 'neutral' | 'warning' | 'success' | 'info' } {
  if (review === 'IN_REVIEW') {
    return { key: 'review', label: 'In review', tone: 'warning' }
  }
  if (status === 'PUBLISHED') {
    return dirty ? { key: 'changed', label: 'Published · draft changes', tone: 'info' } : { key: 'published', label: 'Published', tone: 'success' }
  }
  return { key: 'draft', label: 'Draft', tone: 'neutral' }
}
