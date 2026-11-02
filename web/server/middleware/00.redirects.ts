import { createError, getRequestURL, sendRedirect, setResponseHeader } from 'h3'
import { fetchRedirects, fetchSettings } from '../utils/cms'

/**
 * Before routing (ADR-026): the redirects the console holds, then
 * maintenance mode.
 *
 * - A redirect matches the normalised path; 301 or 302 as stored, the query
 *   string kept.
 * - Maintenance mode answers every page with 503 and the holding message
 *   (`error.vue`), with Retry-After. The draft preview still works, so
 *   staff can check pages before switching it off.
 *
 * Assets, the APIs, media and the image pipeline are never touched. Both
 * lists come from the cached content read (60 s, purged when the console
 * saves), so a change is live on the next request.
 */
const SKIP = ['/api/', '/_nuxt/', '/_ipx/', '/media/', '/fonts/', '/brand/', '/icons/', '/img/', '/preview/', '/__']

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return
  }
  const url = getRequestURL(event)
  const pathname = url.pathname
  if (SKIP.some(prefix => pathname.startsWith(prefix)) || pathname.includes('.')) {
    return
  }
  const [redirects, settings] = await Promise.all([fetchRedirects(), fetchSettings()])
  const normalised = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1).toLowerCase() : pathname.toLowerCase()
  const hit = redirects.find(r => r.from === normalised)
  if (hit) {
    const target = hit.to.startsWith('https://') ? hit.to : `${hit.to}${url.search}`
    return sendRedirect(event, target, hit.status === 302 ? 302 : 301)
  }
  if (settings?.maintenance) {
    setResponseHeader(event, 'retry-after', 3600)
    setResponseHeader(event, 'cache-control', 'no-store')
    throw createError({ statusCode: 503, statusMessage: 'Down for maintenance' })
  }
})
