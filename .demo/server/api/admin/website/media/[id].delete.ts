import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { deleteMedia } from '../../../../utils/website/media'

/**
 * DELETE /api/admin/website/media/:id — remove a file nothing uses. A file
 * on a page (draft or live) or set as the default social image is refused
 * with where it is used (409).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.media')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Media id is required' })
  }
  await deleteMedia(event, actor, id)
  return { deleted: true }
})
