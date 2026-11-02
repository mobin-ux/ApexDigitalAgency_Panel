import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { validateBody } from '../../../../utils/validate'
import { revalidateSite } from '../../../../utils/website/content'
import { createRedirect } from '../../../../utils/website/redirects'

/**
 * POST /api/admin/website/redirects — Add redirect. A loop is refused
 * (409), a chain is flattened, and redirects that pointed at the old
 * address follow it to the new one. The site serves it on the next request.
 */
const bodySchema = z.object({
  fromPath: z.string().trim().min(1).max(512),
  toPath: z.string().trim().min(1).max(2048),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
  note: z.string().trim().max(200).nullable().optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.seo')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await validateBody(event, bodySchema)
  const result = await createRedirect(event, actor, body)
  return { ...result, revalidated: await revalidateSite(event) }
})
