import { z } from 'zod'
import { httpsUrlSchema, isSafeInternalPath, mediaRefSchema } from '../../../shared/cms'
import { getSettings } from '../settings'

/**
 * The website's settings, as a server-side registry (ADR-021).
 *
 * The generic `Setting` table takes any key and any JSON; the platform
 * screen's typed catalogue lives only in its page. Site settings feed the
 * public footer, the Organization markup, the sitemap and robots.txt, so
 * each key is validated here, on the server, against its own schema, and
 * `getWebsiteSettings()` always answers a complete, typed object with the
 * defaults filled in. An empty string keeps the site's standing rule: it
 * hides the thing it would have shown.
 */

const text = (max: number) => z.string().trim().max(max).default('')

export const WEBSITE_SETTINGS = {
  'site.name': { label: 'Site name', group: 'Identity', schema: text(80) },
  'site.url': { label: 'Public address', group: 'Identity', hint: 'Full https:// address of the live site, used for canonical links and the sitemap.', schema: z.union([z.literal(''), httpsUrlSchema]).default('') },
  'site.tagline': { label: 'Tagline', group: 'Identity', schema: text(200) },
  'site.email': { label: 'Contact email', group: 'Contact', schema: z.union([z.literal(''), z.string().trim().email().max(254)]).default('') },
  'site.phone': { label: 'Phone', group: 'Contact', hint: 'Shown only when filled in.', schema: text(40) },
  'site.openingHours': { label: 'Opening hours', group: 'Contact', schema: text(80) },
  'site.companyNumber': { label: 'Company number', group: 'Company facts', hint: 'As on Companies House. Empty hides it.', schema: z.union([z.literal(''), z.string().trim().regex(/^[A-Z0-9]{8}$/i, 'Eight letters or digits')]).default('') },
  'site.vatNumber': { label: 'VAT number', group: 'Company facts', schema: z.union([z.literal(''), z.string().trim().regex(/^GB\s?\d{3}\s?\d{4}\s?\d{2}(?:\s?\d{3})?$/i, 'GB followed by nine or twelve digits')]).default('') },
  'site.icoNumber': { label: 'ICO registration', group: 'Company facts', schema: text(20) },
  'site.address.street': { label: 'Street', group: 'Address', hint: 'Empty hides the address and the directions link.', schema: text(120) },
  'site.address.locality': { label: 'Town', group: 'Address', schema: text(80) },
  'site.address.region': { label: 'County', group: 'Address', schema: text(80) },
  'site.address.postcode': { label: 'Postcode', group: 'Address', schema: text(12) },
  'site.social.linkedin': { label: 'LinkedIn', group: 'Social profiles', schema: z.union([z.literal(''), httpsUrlSchema]).default('') },
  'site.social.instagram': { label: 'Instagram', group: 'Social profiles', schema: z.union([z.literal(''), httpsUrlSchema]).default('') },
  'site.social.x': { label: 'X', group: 'Social profiles', schema: z.union([z.literal(''), httpsUrlSchema]).default('') },
  'site.social.youtube': { label: 'YouTube', group: 'Social profiles', schema: z.union([z.literal(''), httpsUrlSchema]).default('') },
  'site.seo.defaultTitle': { label: 'Default search title', group: 'SEO defaults', schema: text(70) },
  'site.seo.defaultDescription': { label: 'Default search description', group: 'SEO defaults', schema: text(160) },
  'site.seo.ogImage': { label: 'Default social image', group: 'SEO defaults', schema: z.union([z.null(), mediaRefSchema]).default(null) },
  'site.robots.disallow': {
    label: 'Hide from search engines',
    group: 'SEO defaults',
    hint: 'Paths added to robots.txt as Disallow. The site itself, its assets and its APIs can never be listed.',
    schema: z.array(z.string().trim().refine(isSafeInternalPath, 'Must be a site path'))
      .max(50)
      .refine(paths => !paths.some(p => p === '/' || p.startsWith('/_nuxt') || p.startsWith('/api/')), 'The site root, /_nuxt and /api/ cannot be hidden')
      .default([]),
  },
  'site.timezone': { label: 'Time zone', group: 'Publishing', hint: 'For scheduled publishing and dates shown in the panel.', schema: z.string().trim().max(60).default('Europe/London') },
} as const satisfies Record<string, { label: string, group: string, hint?: string, schema: z.ZodTypeAny }>

export type WebsiteSettingKey = keyof typeof WEBSITE_SETTINGS

export const WEBSITE_SETTING_KEYS = Object.keys(WEBSITE_SETTINGS) as WebsiteSettingKey[]

export type WebsiteSettings = { [K in WebsiteSettingKey]: z.infer<typeof WEBSITE_SETTINGS[K]['schema']> }

export function isWebsiteSettingKey(value: unknown): value is WebsiteSettingKey {
  return typeof value === 'string' && value in WEBSITE_SETTINGS
}

/** Every key's default, i.e. what a fresh database answers. */
export function websiteSettingDefaults(): WebsiteSettings {
  const out: Record<string, unknown> = {}
  for (const key of WEBSITE_SETTING_KEYS) {
    out[key] = WEBSITE_SETTINGS[key].schema.parse(undefined)
  }
  return out as WebsiteSettings
}

/**
 * Validate one key's incoming value. Returns the parsed value or the
 * sentence to show; the schema's own message is already written for people.
 */
export function parseWebsiteSetting(key: WebsiteSettingKey, value: unknown): { ok: true, value: unknown } | { ok: false, message: string } {
  const parsed = WEBSITE_SETTINGS[key].schema.safeParse(value)
  if (parsed.success) {
    return { ok: true, value: parsed.data }
  }
  return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid value' }
}

/** The complete, typed settings object: stored values that still validate, defaults for the rest. */
export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  const defaults = websiteSettingDefaults()
  const stored = await getSettings(Object.fromEntries(WEBSITE_SETTING_KEYS.map(key => [key, undefined])))
  const out: Record<string, unknown> = { ...defaults }
  for (const key of WEBSITE_SETTING_KEYS) {
    const value = stored[key]
    if (value === undefined) {
      continue
    }
    const parsed = WEBSITE_SETTINGS[key].schema.safeParse(value)
    if (parsed.success) {
      out[key] = parsed.data
    }
  }
  return out as WebsiteSettings
}
