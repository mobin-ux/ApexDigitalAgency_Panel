import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/signup — customer self-registration.
 * Accepts firstName/lastName, or a single `name` (split on first space)
 * for older callers. Role is always CUSTOMER — privilege escalation at
 * signup is impossible by construction.
 */

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    name: z.string().trim().min(1).max(200).optional(),
  })
  .refine(data => data.firstName || data.name, { message: 'A name is required', path: ['firstName'] })

export default defineEventHandler(async (event) => {
  // Caps automated account creation from one source.
  rateLimit(event, RateLimits.signup)

  const body = await validateBody(event, bodySchema)

  // Normalize the two accepted name shapes into schema fields.
  const [nameFirst, ...nameRest] = (body.name ?? '').split(' ').filter(Boolean)
  const firstName = body.firstName ?? nameFirst
  const lastName = body.lastName ?? (nameRest.join(' ') || null)

  const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
  if (existingUser) {
    throw createError({ statusCode: 409, message: 'An account with this email already exists' })
  }

  const hashedPassword = await bcrypt.hash(body.password, 10)

  const newUser = await prisma.user.create({
    data: {
      email: body.email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'CUSTOMER',
      avatar: '/img/avatars/placeholder.svg',
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  })

  return { status: 'success', user: newUser }
})
