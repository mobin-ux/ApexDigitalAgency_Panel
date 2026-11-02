import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { PASSWORD_MIN } from '../../../shared/password'
import { recordAudit } from '../../utils/audit'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/settings/password — change password after verifying the current one.
 *
 * The new password meets the platform minimum (`shared/password.ts`), the
 * same figure the page asks for; the current-password check is budgeted per
 * account, and both a change and a wrong current password are audited.
 */

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.passwordChange, identity: session.id })
  const { currentPassword, newPassword } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) {
    await recordAudit(event, session, { action: 'auth.password.change.failed', targetType: 'User', targetId: session.id, metadata: { reason: 'wrong_current_password' } })
    throw createError({ statusCode: 403, message: 'Incorrect current password' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: session.id },
    data: { password: hashedPassword },
  })
  await recordAudit(event, session, { action: 'auth.password.changed', targetType: 'User', targetId: session.id })

  return { status: 'success', message: 'Password updated successfully' }
})
