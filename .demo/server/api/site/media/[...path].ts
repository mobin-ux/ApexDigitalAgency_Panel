import { createError, defineEventHandler, getRouterParam } from 'h3'
import { loadMedia, sendMedia } from '../../../utils/website/media'

/**
 * GET or HEAD /api/site/media/:id/:version/:filename — a media-library file,
 * public (ADR-026). The site serves it at `/media/…` by passing the request
 * through; the console shows thumbnails from here. A route file without a
 * method suffix answers both methods. The version and filename in the
 * address are for caches and people; the id decides, so an old address
 * still shows the current file rather than a broken image.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }
  const [id] = (getRouterParam(event, 'path') ?? '').split('/')
  if (!id) {
    throw createError({ statusCode: 404, message: 'Media not found' })
  }
  return sendMedia(event, await loadMedia(id))
})
