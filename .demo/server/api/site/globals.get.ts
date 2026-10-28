import { publicCacheHeaders, publishedGlobals } from '../../utils/website/content-api'

/** The published chrome documents (header, footer, announcement, the chrome globals), keyed by template. */
export default defineEventHandler(async (event) => {
  publicCacheHeaders(event)
  return { globals: await publishedGlobals() }
})
