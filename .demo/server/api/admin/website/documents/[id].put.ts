import { getRouterParam } from 'h3'
import { z } from 'zod'
import { requireStaffPermission } from '../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../utils/ratelimit'
import { validateBody } from '../../../../utils/validate'
import { documentDetail, saveDraft } from '../../../../utils/website/documents'

const bodySchema = z.object({
  version: z.number().int().min(1),
  content: z.unknown(),
  title: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(200).optional(),
})

/** Save the working draft. 400 with field paths on invalid content; 409 when another save landed first. */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')!
  const body = await validateBody(event, bodySchema)
  await saveDraft(event, actor, id, { version: body.version, content: body.content, title: body.title, note: body.note })
  return documentDetail(id)
})
