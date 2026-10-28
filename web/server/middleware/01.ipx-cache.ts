import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createError, getRequestURL, setResponseHeaders } from 'h3'
import { createIPX, createIPXFetchHandler, ipxFSStorage, ipxHttpStorage, parseIPXURL } from 'ipx'
import { cmsConfig } from '../utils/cms'

/**
 * The image pipeline (ADR-021 §4). IPX resizes and re-encodes on every
 * request and never caches, so this route keeps the processed bytes on disk
 * under the request path: the first visitor pays for the resize, the rest
 * read a file. `/media/<id>/<version>/<name>` sources are fetched from the
 * panel's public media route over the configured panel URL; everything
 * else comes from this site's own public directory, as before.
 */
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }

let handler: ((request: Request) => Promise<Response> | Response) | null = null

function getHandler() {
  if (handler) {
    return handler
  }
  const { url } = cmsConfig()
  // IPX matches the hostname of the source URL against this list (no port).
  const domains = url ? [new URL(url).hostname] : []
  const ipx = createIPX({
    storage: ipxFSStorage({ dir: './public' }),
    httpStorage: domains.length ? ipxHttpStorage({ domains, maxAge: 60 }) : undefined,
    alias: url ? { '/media': `${url}/api/site/media` } : {},
    maxAge: 31536000,
  })
  handler = createIPXFetchHandler(ipx, {
    parseURL(input) {
      const parsed = new URL(input)
      const pathname = parsed.pathname.startsWith('/_ipx/') ? parsed.pathname.slice('/_ipx'.length) : parsed.pathname
      return parseIPXURL(parsed.origin + pathname + parsed.search)
    },
  })
  return handler
}

/**
 * A middleware rather than a route: the image module registers its own
 * /_ipx handler first, and the router answers with the first match. Running
 * before the router, this handles /_ipx/** itself and lets everything else
 * through untouched.
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (!url.pathname.startsWith('/_ipx/')) {
    return
  }
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }
  const key = createHash('sha256').update(url.pathname).digest('hex')
  const storage = useStorage('ipx')

  const meta = await storage.getItem<{ type: string, bytes: number }>(`${key}.meta`).catch(() => null)
  if (meta) {
    const data = await storage.getItemRaw<Buffer>(`${key}.bin`).catch(() => null)
    if (data) {
      setResponseHeaders(event, { ...CACHE_HEADERS, 'Content-Type': meta.type, 'Content-Length': String(meta.bytes), 'X-Image-Cache': 'hit' })
      return event.method === 'HEAD' ? '' : Buffer.from(data)
    }
  }

  const response = await getHandler()(new Request(url.toString(), { method: 'GET' }))
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200)
    console.warn(`[ipx] ${url.pathname} -> ${response.status} ${detail}`)
    throw createError({ statusCode: response.status === 404 ? 404 : 502, message: response.status === 404 ? 'Image not found' : 'Image could not be processed' })
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const type = response.headers.get('content-type') ?? 'application/octet-stream'
  await storage.setItemRaw(`${key}.bin`, bytes).catch(() => {})
  await storage.setItem(`${key}.meta`, { type, bytes: bytes.length }).catch(() => {})
  setResponseHeaders(event, { ...CACHE_HEADERS, 'Content-Type': type, 'Content-Length': String(bytes.length), 'X-Image-Cache': 'miss' })
  return event.method === 'HEAD' ? '' : bytes
})
