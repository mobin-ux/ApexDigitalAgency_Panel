import { createError, getQuery } from 'h3'
import { fetchPublishedPage } from '../../utils/cms'

/**
 * Same-origin proxy for one page's published document (`?path=/`), so
 * client-side navigation can read it without the browser ever calling the
 * panel (connect-src stays 'self'). Served from the server's 60 s cache.
 */
export default defineEventHandler(async (event) => {
  const raw = getQuery(event).path
  const path = typeof raw === 'string' && raw.startsWith('/') && raw.length <= 512 ? raw.replace(/\/{2,}/g, '/') : ''
  if (!path) {
    throw createError({ statusCode: 400, message: 'path is required' })
  }
  const doc = await fetchPublishedPage(path)
  if (!doc) {
    throw createError({ statusCode: 404, message: 'No published document at this address' })
  }
  return doc
})
