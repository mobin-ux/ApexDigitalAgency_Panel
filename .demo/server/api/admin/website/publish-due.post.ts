import { requireStaffPermission } from '../../../utils/permissions'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { publishDue } from '../../../utils/website/publish'

/** "Run now": the same job the scheduler runs every minute, for recovery and for tests. */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.publish')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  return publishDue()
})
