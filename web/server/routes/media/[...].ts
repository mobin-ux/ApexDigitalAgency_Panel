import { createError, getRouterParam, sendProxy } from 'h3'
import { cmsConfig } from '../../utils/cms'

/**
 * Files from the media library that are not images (PDFs) are passed
 * through to the panel's public media route; images go through /_ipx.
 * Only GET and HEAD, only under the configured panel URL.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }
  const { url } = cmsConfig()
  const path = getRouterParam(event, '_') ?? ''
  if (!url || !/^[\w-]+\/\d+\/[^/]+$/.test(path)) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  return sendProxy(event, `${url}/api/site/media/${path}`, { sendStream: true })
})
