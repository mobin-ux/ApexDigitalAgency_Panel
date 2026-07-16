import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/users — create an account from the admin panel
 * (typically EMPLOYEE/ADMIN staff accounts; customers self-serve via
 * signup). The password is set by the admin and should be rotated by
 * the user — there is no invite-email flow yet (no mail provider).
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'EMPLOYEE']).default('EMPLOYEE'),
  phone: z.string().trim().max(30).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { email, password, firstName, lastName, role, phone } = await validateBody(event, bodySchema)

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    throw createError({ statusCode: 400, message: 'An account with this email already exists' })
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      firstName,
      lastName: lastName ?? null,
      phone: phone ?? null,
      role,
      status: 'ACTIVE',
      // Admin-created accounts are verified by definition.
      verifiedAt: new Date(),
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
  })

  await recordAudit(event, admin, {
    action: 'admin.user.create',
    targetType: 'User',
    targetId: user.id,
    metadata: { email: user.email, role: user.role },
  })

  return user
})
