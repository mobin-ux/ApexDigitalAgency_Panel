import { z } from 'zod'

/**
 * Link values the CMS may store, and the rules that keep them safe.
 *
 * Three kinds, and nothing else: a path on this site, a named destination in
 * the customer panel (resolved by the site's `usePanelLinks()` at render, so
 * the panel's base URL never lives in content), or an absolute https URL. No
 * `javascript:`, `data:`, protocol-relative or dot-segment paths can be
 * stored, because the schema refuses them before anything is saved.
 */

/** Destinations in the customer panel the site already knows how to reach. */
export const PANEL_LINK_KEYS = ['login', 'signup', 'dashboard', 'newOrder'] as const

export type PanelLinkKey = typeof PANEL_LINK_KEYS[number]

/**
 * A same-site path: starts with one `/`, has no scheme, no `//`, no `..`
 * segment, no whitespace or control characters, and may carry a query or an
 * anchor. `/` alone is allowed.
 */
export function isSafeInternalPath(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    return false
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    return false
  }
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001F\u007F]/.test(value) || value.includes('\\')) {
    return false
  }
  const pathOnly = value.split(/[?#]/)[0]!
  return !pathOnly.split('/').some(segment => segment === '.' || segment === '..')
}

export function isHttpsUrl(value: string): boolean {
  if (typeof value !== 'string' || value.length > 2048) {
    return false
  }
  try {
    const url = new URL(value)
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
    return url.protocol === 'https:' && url.hostname.length > 0 && !/[\s\u0000-\u001F]/.test(value)
  }
  catch {
    return false
  }
}

/**
 * Lower-case the path, strip a trailing slash (except the root) and drop a
 * duplicate leading slash. Used before uniqueness checks on document keys
 * and redirect sources so `/About/` and `/about` cannot both exist.
 */
export function normalisePath(value: string): string {
  let path = value.trim()
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  const [pathname, rest] = splitPath(path)
  let clean = pathname.replace(/\/{2,}/g, '/').toLowerCase()
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1)
  }
  return clean + rest
}

function splitPath(path: string): [string, string] {
  const index = path.search(/[?#]/)
  return index === -1 ? [path, ''] : [path.slice(0, index), path.slice(index)]
}

export const internalPathSchema = z.string().trim().refine(isSafeInternalPath, 'Must be a path on this site, such as /services')

export const httpsUrlSchema = z.string().trim().refine(isHttpsUrl, 'Must be a full https:// address')

export const linkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('internal'), path: internalPathSchema }),
  z.object({ kind: z.literal('panel'), key: z.enum(PANEL_LINK_KEYS) }),
  z.object({ kind: z.literal('external'), url: httpsUrlSchema }),
])

export type LinkValue = z.infer<typeof linkSchema>
