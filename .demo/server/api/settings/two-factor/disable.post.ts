import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { verifySecondFactor } from '../../../utils/two-factor'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/settings/two-factor/disable — turn two-step off. Needs both the
 * password and a code (or a backup code), so a browser left signed in is not
 * enough to remove it.
 */
const bodySchema = z.object({ password: z.string().min(1), code: z.string().trim().min(6).max(12) }).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.login, bucket: 'two-factor:disable', identity: session.id })
  const { password, code } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { password: true } })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw createError({ statusCode: 403, message: 'That password is not right.' })
  }
  if (!(await verifySecondFactor(session.id, code, { backup: true }))) {
    throw createError({ statusCode: 400, message: 'That code did not work.' })
  }
  await prisma.twoFactor.delete({ where: { userId: session.id } })
  await recordAudit(event, session, { action: 'auth.two-factor.disabled', targetType: 'User', targetId: session.id })
  return { status: 'off' }
})
