import { getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { revalidateSite } from '../../../../utils/website/publish'
import { deleteRedirect } from '../../../../utils/website/redirects'

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.seo')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  await deleteRedirect(event, actor, getRouterParam(event, 'id')!)
  await revalidateSite([])
  return { ok: true }
})
