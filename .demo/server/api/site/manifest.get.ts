import { manifest, publicCacheHeaders } from '../../utils/website/content-api'

/** Every published page address (ADR-021): the site's sitemap source and the importer's view of what exists. */
export default defineEventHandler(async (event) => {
  publicCacheHeaders(event)
  return { pages: await manifest() }
})
