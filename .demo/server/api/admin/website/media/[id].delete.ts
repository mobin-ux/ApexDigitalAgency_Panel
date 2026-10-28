import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { deleteMedia } from '../../../../utils/website/media'

/** 409 with the documents that use it while any reference exists. */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.media')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  await deleteMedia(event, actor, getRouterParam(event, 'id')!)
  return { ok: true }
})
