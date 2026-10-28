import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { applyTransition } from '../../../../utils/website/publish'

/** Delete a never-published draft; anything else is a 409 with the sentence the screen shows. */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.publish')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  await applyTransition(event, actor, getRouterParam(event, 'id')!, 'delete')
  return { ok: true }
})
