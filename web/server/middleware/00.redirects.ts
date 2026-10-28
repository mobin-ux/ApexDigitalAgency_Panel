import { getRequestURL, sendRedirect } from 'h3'
import { fetchRedirects } from '../utils/cms'

/**
 * Redirects the panel holds, answered before routing (ADR-021): a normalised
 * path match on the request, 301 or 302 as stored, the query string kept.
 * Assets, the APIs and the image pipeline are never redirected. The map is
 * the cached content read (60 s, purged on publish), so a new redirect is
 * live on the next request.
 */
const SKIP = ['/api/', '/_nuxt/', '/_ipx/', '/media/', '/fonts/', '/brand/', '/icons/', '/preview/', '/__']

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return
  }
  const url = getRequestURL(event)
  const pathname = url.pathname
  if (SKIP.some(prefix => pathname.startsWith(prefix)) || pathname.includes('.')) {
    return
  }
  const redirects = await fetchRedirects()
  if (!redirects.length) {
    return
  }
  const normalised = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1).toLowerCase() : pathname.toLowerCase()
  const hit = redirects.find(r => r.from === normalised)
  if (!hit) {
    return
  }
  const target = hit.to.startsWith('https://') ? hit.to : `${hit.to}${url.search}`
  return sendRedirect(event, target, hit.status === 302 ? 302 : 301)
})
