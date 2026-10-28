import { createError } from 'h3'
import { z } from 'zod'
import { validateQuery } from '../../utils/validate'
import { publicCacheHeaders, publishedPage } from '../../utils/website/content-api'

const querySchema = z.object({ path: z.string().min(1).max(512) })

/**
 * The published document at one address (`?path=/offers/spring`; the root
 * is `?path=/`), or 404. Only published revisions are ever served here;
 * drafts go through the preview token route.
 */
export default defineEventHandler(async (event) => {
  publicCacheHeaders(event)
  const { path } = validateQuery(event, querySchema)
  const doc = await publishedPage(path)
  if (!doc) {
    throw createError({ statusCode: 404, message: 'No published document at this address' })
  }
  return doc
})
