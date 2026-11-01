import { defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { checkStaffPassword, signStaffCodeTicket, signStaffEnrolTicket } from '../../../utils/staff-auth'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/auth/login — the staff sign-in's password step (ADR-025).
 * Never sets a cookie: the answer is a ticket for the code step, or, for a
 * staff account without two-step yet, a ticket for setting it up first.
 */
const bodySchema = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(200),
}).strict()

export default defineEventHandler(async (event) => {
  const { email, password } = await validateBody(event, bodySchema)
  const user = await checkStaffPassword(event, email, password)
  const twoFactor = await prisma.twoFactor.findUnique({ where: { userId: user.id }, select: { enabledAt: true } })
  if (twoFactor?.enabledAt) {
    return { status: 'two_factor' as const, ticket: signStaffCodeTicket(event, user.id) }
  }
  return { status: 'enrol' as const, ticket: signStaffEnrolTicket(event, user.id) }
})
