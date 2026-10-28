import { createError, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../../../../../utils/ratelimit'
import { documentDetail, restoreRevision } from '../../../../../../../utils/website/documents'

/** Copy an earlier revision into the working draft (as a new revision; history is never rewritten). */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const id = getRouterParam(event, 'id')!
  const number = Number(getRouterParam(event, 'number'))
  if (!Number.isInteger(number) || number < 1) {
    throw createError({ statusCode: 400, message: 'Revision numbers start at 1' })
  }
  await restoreRevision(event, actor, id, number)
  return documentDetail(id)
})
