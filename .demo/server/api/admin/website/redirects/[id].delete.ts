import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { revalidateSite } from '../../../../utils/website/content'
import { deleteRedirect } from '../../../../utils/website/redirects'

/** DELETE /api/admin/website/redirects/:id — Remove redirect. Visitors to the old address get whatever is there now. */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.seo')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Redirect id is required' })
  }
  await deleteRedirect(event, actor, id)
  return { deleted: true, revalidated: await revalidateSite(event) }
})
