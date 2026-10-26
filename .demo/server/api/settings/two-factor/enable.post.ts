import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAuth } from '../../../utils/auth'
import { decryptField } from '../../../utils/crypto'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { matchTotp, newBackupCodes } from '../../../utils/totp'
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

  const row = await prisma.twoFactor.findUnique({ where: { userId: session.id } })
  if (row?.enabledAt) {
    throw createError({ statusCode: 409, message: 'Two-step verification is already on.' })
  }
  if (!row?.pending) {
    throw createError({ statusCode: 400, message: 'Start again: scan the new code first.' })
  }
  const secret = decryptField(row.pending)
  const step = matchTotp(secret, code, null)
  if (step === null) {
    throw createError({ statusCode: 400, message: 'That code did not match. Check the time on your phone and try the newest code.' })
  }
  const { codes, hashes } = newBackupCodes()
  const { count } = await prisma.twoFactor.updateMany({
    where: { userId: session.id, pending: row.pending, enabledAt: null },
    data: { secret: row.pending, pending: null, enabledAt: new Date(), lastStep: step, backupCodes: JSON.stringify(hashes) },
  })
  if (!count) {
    throw createError({ statusCode: 409, message: 'Two-step verification changed in another window. Reload and try again.' })
  }
  await recordAudit(event, session, { action: 'auth.two-factor.enabled', targetType: 'User', targetId: session.id })
  return { backupCodes: codes }
})
