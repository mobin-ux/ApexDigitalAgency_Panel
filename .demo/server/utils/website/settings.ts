import type { Permission } from '../../../shared/permissions'
import { z } from 'zod'
import { httpsUrlSchema, isSafeInternalPath } from '../../../shared/cms'
import { getSettings } from '../settings'

/**
 * The website's settings (ADR-026, `Admin Console.dc.html` › Site settings),
 * as a server-side registry: each key is validated here against its own
 * schema, and `getWebsiteSettings()` always answers a complete, typed
 * object with the defaults filled in. They are stored in the generic
 * `Setting` table under `site.*`.
 *
 * An empty string means "not set": the site keeps its code baseline for
 * that fact, and the site's standing rule still holds (an empty fact hides
 * the thing it would have shown), so no placeholder company number or
 * phone line can reach the public pages.
 *
 * Every key is Owner-only (`website.settings`) except the robots.txt
 * additions, which belong to SEO & redirects (`website.seo`).
 */

const text = (max: number) => z.string().trim().max(max).default('')
const https = z.union([z.literal(''), httpsUrlSchema]).default('')

export const WEBSITE_SETTINGS = {
  'site.legalName': { label: 'Registered name', permission: 'website.settings', schema: text(120) },
  'site.name': { label: 'Trading name', permission: 'website.settings', schema: text(80) },
  'site.companyNumber': { label: 'Company number', permission: 'website.settings', schema: z.union([z.literal(''), z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}$/, 'Eight letters or digits, as on Companies House')]).default('') },
  'site.vatNumber': { label: 'VAT number', permission: 'website.settings', schema: z.union([z.literal(''), z.string().trim().toUpperCase().regex(/^GB\s?\d{3}\s?\d{4}\s?\d{2}(?:\s?\d{3})?$/, 'GB followed by nine or twelve digits')]).default('') },
  'site.icoNumber': { label: 'ICO registration', permission: 'website.settings', schema: z.union([z.literal(''), z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}\d{6,8}$/, 'As on the ICO register, e.g. ZA123456')]).default('') },
  'site.address.street': { label: 'Street', permission: 'website.settings', schema: text(120) },
  'site.address.locality': { label: 'Town', permission: 'website.settings', schema: text(80) },
  'site.address.region': { label: 'County', permission: 'website.settings', schema: text(80) },
  'site.address.postcode': { label: 'Postcode', permission: 'website.settings', schema: z.union([z.literal(''), z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/, 'A UK postcode, e.g. ME14 1XX')]).default('') },
  'site.email': { label: 'Contact email', permission: 'website.settings', schema: z.union([z.literal(''), z.string().trim().email('An email address').max(254)]).default('') },
  'site.phone': { label: 'Phone', permission: 'website.settings', schema: z.union([z.literal(''), z.string().trim().regex(/^\+?[\d\s()-]{7,20}$/, 'A phone number')]).default('') },
  'site.social.linkedin': { label: 'LinkedIn', permission: 'website.settings', schema: https },
  'site.social.instagram': { label: 'Instagram', permission: 'website.settings', schema: https },
  'site.social.x': { label: 'X', permission: 'website.settings', schema: https },
  'site.social.youtube': { label: 'YouTube', permission: 'website.settings', schema: https },
  'site.seo.ogImage': { label: 'Default social image', permission: 'website.settings', schema: z.string().trim().max(64).default('') },
  'site.maintenance': { label: 'Maintenance mode', permission: 'website.settings', schema: z.boolean().default(false) },
  'site.robots.disallow': {
    label: 'Hidden from search engines',
    permission: 'website.seo',
    schema: z.array(z.string().trim().refine(isSafeInternalPath, 'Each line must be a path on the site, such as /landing/old-offer'))
      .max(50, 'At most 50 lines')
      .refine(paths => !paths.some(p => p === '/' || p.startsWith('/_nuxt') || p.startsWith('/media')), 'The whole site, /_nuxt and /media cannot be hidden')
      .default([]),
  },
} as const satisfies Record<string, { label: string, permission: Permission, schema: z.ZodTypeAny }>

export type WebsiteSettingKey = keyof typeof WEBSITE_SETTINGS

export const WEBSITE_SETTING_KEYS = Object.keys(WEBSITE_SETTINGS) as WebsiteSettingKey[]

export type WebsiteSettings = { [K in WebsiteSettingKey]: z.infer<typeof WEBSITE_SETTINGS[K]['schema']> }

export function isWebsiteSettingKey(value: unknown): value is WebsiteSettingKey {
  return typeof value === 'string' && value in WEBSITE_SETTINGS
}

export function websiteSettingDefaults(): WebsiteSettings {
  return Object.fromEntries(WEBSITE_SETTING_KEYS.map(key => [key, WEBSITE_SETTINGS[key].schema.parse(undefined)])) as WebsiteSettings
}

/** One key's incoming value: the parsed value, or the sentence to show beside the field. */
export function parseWebsiteSetting(key: WebsiteSettingKey, value: unknown): { ok: true, value: unknown } | { ok: false, message: string } {
  const parsed = WEBSITE_SETTINGS[key].schema.safeParse(value)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid value' }
}

/** The complete, typed settings: stored values that still validate, defaults for the rest. */
export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  const out: Record<string, unknown> = websiteSettingDefaults()
  const stored = await getSettings(Object.fromEntries(WEBSITE_SETTING_KEYS.map(key => [key, undefined])))
  for (const key of WEBSITE_SETTING_KEYS) {
    if (stored[key] === undefined) {
      continue
    }
    const parsed = WEBSITE_SETTINGS[key].schema.safeParse(stored[key])
    if (parsed.success) {
      out[key] = parsed.data
    }
  }
  return out as WebsiteSettings
}
