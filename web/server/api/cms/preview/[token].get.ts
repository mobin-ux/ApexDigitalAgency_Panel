import { createError, getRouterParam, setHeader } from 'h3'
import { fetchPreview } from '../../../utils/cms'

/** Same-origin proxy for a draft preview; never cached. */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const doc = await fetchPreview(getRouterParam(event, 'token') ?? '')
  if (!doc) {
    throw createError({ statusCode: 404, message: 'This preview link is not valid or has expired' })
  }
  return doc
})
