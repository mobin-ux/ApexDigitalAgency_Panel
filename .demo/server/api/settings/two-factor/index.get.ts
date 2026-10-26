import { defineEventHandler } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { twoFactorStatus } from '../../../utils/two-factor'

/** GET /api/settings/two-factor — on or off, since when, and backup codes left. */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  return twoFactorStatus(session.id)
})
