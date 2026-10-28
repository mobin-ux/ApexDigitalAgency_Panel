import type { TemplateKey } from '../../shared/cms'

/**
 * The site's read side of the CMS (ADR-021 §2).
 *
 * The server fetches published content from the panel over the configured
 * URL (localhost in production), caches each answer for 60 s with
 * stale-while-revalidate, and keeps the last good answer in `useStorage('cms')`
 * (a directory on disk) so a panel outage renders the last published words
 * rather than the baseline. With no panel configured every read answers
 * null and the pages render their code baseline — the CMS-off path that
 * Gate 3 proved identical.
 *
 * The browser never calls the panel: the strict CSP's connect-src stays
 * 'self', and client-side navigation goes through this server's own
 * /api/cms/** proxies.
 */

export interface CmsDocument {
  id: string
  kind: string
  template: TemplateKey
  key: string
  title: string
  revision: number
  publishedAt: string | null
  content: unknown
}

export const CMS_CACHE_SECONDS = 60

export function cmsConfig(): { url: string, secret: string } {
  const config = useRuntimeConfig().cms as { url?: string, revalidateSecret?: string } | undefined
  return { url: (config?.url ?? '').replace(/\/$/, ''), secret: config?.revalidateSecret ?? '' }
}

export function cmsEnabled(): boolean {
  return cmsConfig().url !== ''
}

/** One flat file per snapshot: a path separator in a key would become a directory the driver may not create. */
function snapshotKey(name: string): string {
  return `snapshot:${name.replace(/[^a-z0-9-]/gi, '_')}`
}

/**
 * One fetch with a snapshot behind it. On success the answer is stored; on
 * any failure the stored answer is returned (and a warning logged once per
 * key per process); with neither, null.
 */
const warned = new Set<string>()

async function fetchWithSnapshot<T>(name: string, path: string): Promise<T | null> {
  const { url } = cmsConfig()
  if (!url) {
    return null
  }
  const storage = useStorage('cms')
  try {
    const data = await getJson<T>(`${url}${path}`)
    warned.delete(name)
    // The snapshot is a courtesy for outages; failing to write it must not fail the read.
    try {
      await storage.setItem(snapshotKey(name), { at: Date.now(), data })
    }
    catch (error) {
      console.warn(`[cms] could not store the snapshot for ${name}: ${(error as Error).message}`)
    }
    return data
  }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404) {
      // The panel answered: there is no published document at this address.
      await storage.removeItem(snapshotKey(name)).catch(() => {})
      return null
    }
    const stored = await storage.getItem<{ at: number, data: T }>(snapshotKey(name)).catch(() => null)
    if (!warned.has(name)) {
      warned.add(name)
      console.warn(`[cms] ${path} unavailable (${status ?? (error as Error).message}); ${stored ? 'serving the last good snapshot' : 'rendering the code baseline'}`)
    }
    return stored?.data ?? null
  }
}

/** The published document at a page address, or null (no document, or no panel). */
export const fetchPublishedPage = defineCachedFunction(
  async (path: string): Promise<CmsDocument | null> => fetchWithSnapshot<CmsDocument>(`page${path}`, `/api/site/page?path=${encodeURIComponent(path)}`),
  { name: 'cms', getKey: (path: string) => `page:${path}`, maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** The published chrome documents keyed by template, or an empty map. */
export const fetchGlobals = defineCachedFunction(
  async (): Promise<Record<string, CmsDocument>> => {
    const data = await fetchWithSnapshot<{ globals: Record<string, CmsDocument> }>('globals', '/api/site/globals')
    return data?.globals ?? {}
  },
  { name: 'cms', getKey: () => 'globals', maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** Every published page address, for the sitemap. */
export const fetchManifest = defineCachedFunction(
  async (): Promise<{ key: string, template: string, title: string, publishedAt: string | null, landing: boolean, noindex: boolean }[]> => {
    const data = await fetchWithSnapshot<{ pages: { key: string, template: string, title: string, publishedAt: string | null, landing: boolean, noindex: boolean }[] }>('manifest', '/api/site/manifest')
    return data?.pages ?? []
  },
  { name: 'cms', getKey: () => 'manifest', maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** A plain GET with a short timeout; a non-2xx answer throws with its status. Native fetch, because a typed route helper cannot type a URL built at runtime. */
class UpstreamError extends Error {
  constructor(public statusCode: number) {
    super(`upstream ${statusCode}`)
  }
}

async function getJson<T>(target: string): Promise<T> {
  const res = await fetch(target, { signal: AbortSignal.timeout(3000), headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new UpstreamError(res.status)
  }
  return await res.json() as T
}

export interface CmsSettings {
  name: string
  url: string
  tagline: string
  email: string
  phone: string
  openingHours: string
  companyNumber: string
  vatNumber: string
  icoNumber: string
  address: { street: string, locality: string, region: string, postcode: string }
  social: { linkedin: string, instagram: string, x: string, youtube: string }
  seo: { defaultTitle: string, defaultDescription: string, ogImage: { src: string, width: number | null, height: number | null, alt: string } | null }
  robotsDisallow: string[]
  timezone: string
}

/** The site settings the panel holds, or null (no panel): the code baseline then stands. */
export const fetchSettings = defineCachedFunction(
  async (): Promise<CmsSettings | null> => fetchWithSnapshot<CmsSettings>('settings', '/api/site/settings'),
  { name: 'cms', getKey: () => 'settings', maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** A draft, by preview token. Never cached, never snapshotted. */
export async function fetchPreview(token: string): Promise<CmsDocument | null> {
  const { url } = cmsConfig()
  if (!url || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    return null
  }
  try {
    return await getJson<CmsDocument>(`${url}/api/site/preview/${token}`)
  }
  catch {
    return null
  }
}

/** Drop every cached CMS answer, so the next request re-reads the panel. */
export async function purgeCmsCache(): Promise<number> {
  const cache = useStorage('cache')
  const keys = await cache.getKeys('nitro:functions:cms')
  await Promise.all(keys.map(key => cache.removeItem(key)))
  const sitemap = await cache.getKeys('sitemap')
  await Promise.all(sitemap.map(key => cache.removeItem(key)))
  return keys.length
}
