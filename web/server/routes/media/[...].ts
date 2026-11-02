import { createError, getRouterParam, sendProxy } from 'h3'
import { cmsConfig } from '../../utils/cms'

/**
 * Media-library files (ADR-026): `/media/:id/:version/:name` is passed
 * through to the console's public media route, so pages keep a same-origin
 * address (the CSP allows images from 'self' only) and the browser never
 * talks to the console. GET and HEAD only; the address shape is checked
 * before anything is forwarded.
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
