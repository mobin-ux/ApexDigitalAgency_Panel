import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { startSession } from '../../../utils/auth'
import { clientIp } from '../../../utils/ratelimit'
import { publicStaff, staffFromTicket } from '../../../utils/staff-auth'
import { verifySecondFactor } from '../../../utils/two-factor'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/auth/login-2fa — the staff sign-in's code step: the ticket
 * from the password step plus an authenticator code or a backup code. Starts
 * a staff session (ADR-025), the only kind the admin API accepts.
 */
const bodySchema = z.object({
  ticket: z.string().min(1).max(2000),
  code: z.string().trim().min(6).max(12),
}).strict()

export default defineEventHandler(async (event) => {
  const { ticket, code } = await validateBody(event, bodySchema)
  const user = await staffFromTicket(event, ticket, 'code')
  const via = await verifySecondFactor(user.id, code, { backup: true })
  if (!via) {
    await recordAudit(event, { id: user.id, email: user.email ?? user.id, staffRole: user.staffRole ?? undefined }, {
      action: 'auth.staff.login.failed',
      targetType: 'User',
      targetId: user.id,
      metadata: { reason: 'bad_two_factor_code', ip: clientIp(event) },
    })
    throw createError({ statusCode: 400, message: 'That code did not work. Use the newest code from your app, or a backup code.' })
  }
  await startSession(event, user, 'staff')
  await recordAudit(event, { id: user.id, email: user.email ?? user.id, staffRole: user.staffRole ?? undefined }, {
    action: 'auth.staff.login',
    targetType: 'User',
    targetId: user.id,
    metadata: { via, ip: clientIp(event) },
  })
  return { status: 'success' as const, via, user: publicStaff(user) }
})
