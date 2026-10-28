import { createError, getRouterParam } from 'h3'
import { loadMedia, sendMedia } from '../../../utils/website/media'

/**
 * GET or HEAD /api/site/media/:id/:version/:filename. A route file without
 * a method suffix answers both; a `.get.ts` route answers HEAD with 405,
 * and the site's image pipeline asks HEAD before GET. The version and
 * filename in the address are for caches and people; the id decides.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }
  const [id, version] = (getRouterParam(event, 'path') ?? '').split('/')
  if (!id) {
    throw createError({ statusCode: 404, message: 'Media not found' })
  }
  const row = await loadMedia(id)
  if (version && Number(version) !== row.version) {
    // An old address: send the current file with the current headers rather than 404,
    // so a page cached with the previous version still shows a picture.
  }
  return sendMedia(event, row)
})
