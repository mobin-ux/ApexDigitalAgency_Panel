import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { validateBody } from '../../../../utils/validate'
import { revalidateSite } from '../../../../utils/website/publish'
import { createRedirect } from '../../../../utils/website/redirects'

const bodySchema = z.object({
  fromPath: z.string().trim().min(1).max(512),
  toPath: z.string().trim().min(1).max(2048),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
  enabled: z.boolean().optional(),
  note: z.string().trim().max(200).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.seo')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await validateBody(event, bodySchema)
  const result = await createRedirect(event, actor, body)
  await revalidateSite([result.redirect.fromPath])
  return result
})
