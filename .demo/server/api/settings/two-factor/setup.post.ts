import { defineEventHandler } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { beginTwoFactorSetup } from '../../../utils/two-factor'

/**
 * POST /api/settings/two-factor/setup — start turning two-step on: a new
 * secret, kept as `pending` until a code from the app proves it was added
 * (`enable`). Calling it again replaces the pending secret, so an abandoned
 * setup leaves nothing that works.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  return beginTwoFactorSetup(session.id)
})
