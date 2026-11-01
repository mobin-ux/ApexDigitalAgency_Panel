import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { startSession } from '../../../../utils/auth'
import { clientIp } from '../../../../utils/ratelimit'
import { publicStaff, staffFromTicket } from '../../../../utils/staff-auth'
import { confirmTwoFactorSetup } from '../../../../utils/two-factor'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/auth/enrol/finish — a code for the pending secret turns
 * two-step on, returns the ten backup codes (shown once) and starts the
 * staff session the sign-in was for. The code just proved possession of the
 * app, which is the second factor this sign-in asks for.
 */
const bodySchema = z.object({
  ticket: z.string().min(1).max(2000),
  code: z.string().trim().min(6).max(12),
}).strict()

export default defineEventHandler(async (event) => {
  const { ticket, code } = await validateBody(event, bodySchema)
  const user = await staffFromTicket(event, ticket, 'enrol')
  const backupCodes = await confirmTwoFactorSetup(user.id, code)
  const actor = { id: user.id, email: user.email ?? user.id, staffRole: user.staffRole ?? undefined }
  await recordAudit(event, actor, { action: 'auth.two-factor.enabled', targetType: 'User', targetId: user.id, metadata: { at: 'staff-sign-in' } })
  await startSession(event, user, 'staff')
  await recordAudit(event, actor, { action: 'auth.staff.login', targetType: 'User', targetId: user.id, metadata: { via: 'enrolment', ip: clientIp(event) } })
  return { status: 'success' as const, backupCodes, user: publicStaff(user) }
})
