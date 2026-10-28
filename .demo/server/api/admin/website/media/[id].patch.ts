import { getRouterParam } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { validateBody } from '../../../../utils/validate'
import { publicMedia, updateMedia } from '../../../../utils/website/media'

const bodySchema = z.object({ alt: z.string().max(300).optional(), caption: z.string().max(300).nullable().optional() })

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.media')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await validateBody(event, bodySchema)
  return publicMedia(await updateMedia(event, actor, getRouterParam(event, 'id')!, body))
})
