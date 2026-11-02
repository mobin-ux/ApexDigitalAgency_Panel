import { createError, getQuery } from 'h3'
import { fetchPublishedPage } from '../../utils/cms'

/**
 * Same-origin read of one page's published document (`?path=/`), so
 * client-side navigation can reach it without the browser ever calling the
 * panel (connect-src stays 'self'). Served from the server's 60 s cache.
 * Answers `{ document: null }` when nothing is published there: the page
 * then renders its code baseline, which is not an error.
 */
export default defineEventHandler(async (event) => {
  const raw = getQuery(event).path
  const path = typeof raw === 'string' && raw.startsWith('/') && raw.length <= 512 ? raw.replace(/\/{2,}/g, '/') : ''
  if (!path) {
    throw createError({ statusCode: 400, message: 'path is required' })
  }
  return { document: await fetchPublishedPage(path) }
})
