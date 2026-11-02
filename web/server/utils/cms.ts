import { writeLog } from '#shared/log'

/**
 * The site's read side of the admin console's Website screens (ADR-026).
 *
 * This server fetches published content from the panel (loopback in
 * production), caches each answer for 60 s with stale-while-revalidate, and
 * keeps the last good answer in `useStorage('cms')` (a directory on disk) so
 * a panel outage renders the last published words rather than falling back
 * to the code. With no panel configured every read answers null and every
 * page renders its code baseline, exactly as before the console managed it.
 *
 * The browser never calls the panel: the strict CSP's connect-src stays
 * 'self', and client-side navigation goes through this server's own
 * /api/cms/** routes.
 */

export interface CmsDocument {
  id: string
  kind: string
  template: string
  key: string
  title: string
  revision: number | null
  publishedAt: string | null
  content: unknown
  preview?: boolean
}

export interface CmsManifestEntry {
  key: string
  template: string
  title: string
  publishedAt: string | null
  built: boolean
  noindex: boolean
  meta: Record<string, unknown> | null
}

export const CMS_CACHE_SECONDS = 60

/**
 * Bumped by every purge and part of every cache key. With stale-while-
 * revalidate a background refresh can still be in flight when a publish
 * purges the cache; if it finished afterwards it would write the old answer
 * back for a minute. Under a new generation that late write lands on a key
 * nothing reads any more.
 */
let generation = 0

export function cmsConfig(): { url: string, secret: string } {
  const config = useRuntimeConfig().cms as { url?: string, revalidateSecret?: string } | undefined
  return { url: (config?.url ?? '').replace(/\/$/, ''), secret: config?.revalidateSecret ?? '' }
}

/** One flat file per snapshot: a path separator in a key would become a directory the driver may not create. */
function snapshotKey(name: string): string {
  return `snapshot:${name.replace(/[^a-z0-9-]/gi, '_')}`
}

class UpstreamError extends Error {
  constructor(public statusCode: number) {
    super(`upstream ${statusCode}`)
  }
}

/** A plain GET with a short timeout. Native fetch, because a typed route helper cannot type a URL built at runtime. */
async function getJson<T>(target: string): Promise<T> {
  const res = await fetch(target, { signal: AbortSignal.timeout(3000), headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new UpstreamError(res.status)
  }
  return await res.json() as T
}

const warned = new Set<string>()

/**
 * One fetch with a snapshot behind it. On success the answer is stored; on
 * a 404 (the panel answered: nothing published there) the snapshot is
 * dropped; on any other failure the stored answer is returned, with a
 * warning logged once per key per process.
 */
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
      writeLog({ level: 'warn', category: 'content', event: 'site.cms.snapshot-failed', message: `Could not store the snapshot for ${name}`, outcome: 'failure', error })
    }
    return data
  }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404) {
      await storage.removeItem(snapshotKey(name)).catch(() => {})
      return null
    }
    const stored = await storage.getItem<{ at: number, data: T }>(snapshotKey(name)).catch(() => null)
    if (!warned.has(name)) {
      warned.add(name)
      writeLog({ level: 'warn', category: 'content', event: 'site.cms.unavailable', message: `${path} unavailable; ${stored ? 'serving the last good snapshot' : 'rendering the code baseline'}`, outcome: 'failure', error, data: { status } })
    }
    return stored?.data ?? null
  }
}

/** The published document at a page address, or null (none published there, or no panel). */
export const fetchPublishedPage = defineCachedFunction(
  async (path: string): Promise<CmsDocument | null> => fetchWithSnapshot<CmsDocument>(`page${path}`, `/api/site/page?path=${encodeURIComponent(path)}`),
  { name: 'cms', getKey: (path: string) => `${generation}:page:${path}`, maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** The published chrome documents keyed by template, or an empty map. */
export const fetchGlobals = defineCachedFunction(
  async (): Promise<Record<string, CmsDocument>> => {
    const data = await fetchWithSnapshot<{ globals: Record<string, CmsDocument> }>('globals', '/api/site/globals')
    return data?.globals ?? {}
  },
  { name: 'cms', getKey: () => `${generation}:globals`, maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** Every published page address, for the sitemap and the built-article and case-study lists. */
export const fetchManifest = defineCachedFunction(
  async (): Promise<CmsManifestEntry[]> => {
    const data = await fetchWithSnapshot<{ pages: CmsManifestEntry[] }>('manifest', '/api/site/manifest')
    return data?.pages ?? []
  },
  { name: 'cms', getKey: () => `${generation}:manifest`, maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** What Site settings in the console holds (empty strings are "not set"). */
export interface CmsSettings {
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
  robotsDisallow: string[]
}

/** Site settings, or null (no panel, or never reached). */
export const fetchSettings = defineCachedFunction(
  async (): Promise<CmsSettings | null> => fetchWithSnapshot<CmsSettings>('settings', '/api/site/settings'),
  { name: 'cms', getKey: () => `${generation}:settings`, maxAge: CMS_CACHE_SECONDS, swr: true },
)

/** The redirects the console holds, for the redirect middleware. */
export const fetchRedirects = defineCachedFunction(
  async (): Promise<{ from: string, to: string, status: number }[]> => {
    const data = await fetchWithSnapshot<{ redirects: { from: string, to: string, status: number }[] }>('redirects', '/api/site/redirects')
    return data?.redirects ?? []
  },
  { name: 'cms', getKey: () => `${generation}:redirects`, maxAge: CMS_CACHE_SECONDS, swr: true },
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

/** Drop every cached answer, so the next request re-reads the panel. */
export async function purgeCmsCache(): Promise<number> {
  generation += 1
  const cache = useStorage('cache')
  const keys = await cache.getKeys('nitro:functions:cms')
  await Promise.all(keys.map(key => cache.removeItem(key)))
  const sitemap = await cache.getKeys('sitemap')
  await Promise.all(sitemap.map(key => cache.removeItem(key)))
  return keys.length
}
