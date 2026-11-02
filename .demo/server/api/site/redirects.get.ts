import { defineEventHandler, setResponseHeader } from 'h3'
import { publicRedirects } from '../../utils/website/redirects'

/**
 * GET /api/site/redirects — the enabled redirects, for the public site's
 * middleware (ADR-026). Public: it says only where old addresses lead.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'public, max-age=30')
  return { redirects: await publicRedirects() }
})
