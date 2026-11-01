import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAuth } from '../../../utils/auth'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { confirmTwoFactorSetup } from '../../../utils/two-factor'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/settings/two-factor/enable — finish setup with a code from the
 * app. Turns two-step on and returns ten backup codes, the only time they are
 * shown: the server keeps their hashes.
 */
const bodySchema = z.object({ code: z.string().trim().min(6).max(12) }).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.login, bucket: 'two-factor:enable', identity: session.id })
  const { code } = await validateBody(event, bodySchema)
  const backupCodes = await confirmTwoFactorSetup(session.id, code)
  await recordAudit(event, session, { action: 'auth.two-factor.enabled', targetType: 'User', targetId: session.id })
  return { backupCodes }
})
