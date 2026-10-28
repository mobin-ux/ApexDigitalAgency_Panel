import { createError, getRouterParam } from 'h3'
import { z } from 'zod'
import { ACTION_PERMISSION, WORKFLOW_ACTIONS } from '../../../../../../shared/cms'
import { requireStaffPermission } from '../../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../../utils/ratelimit'
import { validateBody } from '../../../../../utils/validate'
import { documentDetail } from '../../../../../utils/website/documents'
import { applyTransition } from '../../../../../utils/website/publish'

const bodySchema = z.object({
  action: z.enum(WORKFLOW_ACTIONS),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(200).optional(),
})

/**
 * One workflow action. The permission is the action's own (submit needs
 * website.edit, everything else website.publish), read from the shared
 * table so the buttons and the gate agree. Delete has its own route.
 */
export default defineEventHandler(async (event) => {
  const body = await validateBody(event, bodySchema)
  if (body.action === 'delete') {
    throw createError({ statusCode: 400, message: 'Use DELETE on the document to delete a draft.' })
  }
  const actor = await requireStaffPermission(event, ACTION_PERMISSION[body.action])
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')!
  const result = await applyTransition(event, actor, id, body.action, { scheduledFor: body.scheduledFor ?? null })
  return { ...(await documentDetail(id)), revalidated: result.revalidated }
})
