import { publicCacheHeaders } from '../../utils/website/content-api'
import { publicRedirects } from '../../utils/website/redirects'

/** The enabled redirects (public, cacheable): the site's middleware reads them. */
export default defineEventHandler(async (event) => {
  publicCacheHeaders(event)
  return { redirects: await publicRedirects() }
})
