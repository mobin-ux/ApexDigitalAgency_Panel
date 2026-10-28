import { getRouterParam } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../../utils/ratelimit'
import { validateBody } from '../../../../../utils/validate'
import { duplicateDocument, summarise } from '../../../../../utils/website/documents'

const bodySchema = z.object({ key: z.string().trim().max(200).optional(), title: z.string().trim().min(1).max(120).optional() })

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const body = await validateBody(event, bodySchema)
  return summarise(await duplicateDocument(event, actor, getRouterParam(event, 'id')!, body))
})
