import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { staffFromTicket } from '../../../../utils/staff-auth'
import { beginTwoFactorSetup } from '../../../../utils/two-factor'
import { validateBody } from '../../../../utils/validate'

/**
 * POST /api/admin/auth/enrol/start — a staff account signing in without
 * two-step gets a new authenticator secret here (ADR-025). It is pending
 * until `enrol/finish` receives a code for it, so an abandoned setup leaves
 * the account exactly as it was: unable to reach the console.
 */
const bodySchema = z.object({ ticket: z.string().min(1).max(2000) }).strict()

export default defineEventHandler(async (event) => {
  const { ticket } = await validateBody(event, bodySchema)
  const user = await staffFromTicket(event, ticket, 'enrol')
  return beginTwoFactorSetup(user.id)
})
