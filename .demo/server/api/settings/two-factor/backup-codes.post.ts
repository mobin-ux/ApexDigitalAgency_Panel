import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { newBackupCodes } from '../../../utils/totp'
import { verifySecondFactor } from '../../../utils/two-factor'
import { validateBody } from '../../../utils/validate'

/** POST /api/settings/two-factor/backup-codes — ten new codes for a code from the app; the old ones stop working. */
const bodySchema = z.object({ code: z.string().trim().min(6).max(12) }).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.login, bucket: 'two-factor:codes', identity: session.id })
  const { code } = await validateBody(event, bodySchema)
  if (!(await verifySecondFactor(session.id, code))) {
    throw createError({ statusCode: 400, message: 'That code did not match. Use the newest code from your app.' })
  }
  const { codes, hashes } = newBackupCodes()
  await prisma.twoFactor.update({ where: { userId: session.id }, data: { backupCodes: JSON.stringify(hashes) } })
  await recordAudit(event, session, { action: 'auth.two-factor.backup-codes', targetType: 'User', targetId: session.id })
  return { backupCodes: codes }
})
