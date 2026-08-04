import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { issueAuthToken, setAuthCookie } from '../../utils/auth'
import { identifierWhere, parseIdentifier } from '../../utils/identifier'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/signup — customer self-registration.
 *
 * The account is created from a single `identifier` that is either an email
 * address or a mobile phone number (see utils/identifier). Name is optional.
 * Role is always CUSTOMER — privilege escalation at signup is impossible by
 * construction. On success the session cookie is set, so the new user is
 * signed in immediately; they can equally sign in later with the same
 * identifier + password.
 */

const bodySchema = z
  .object({
    // `identifier` is the new field; `email` is accepted for older callers.
    identifier: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().max(200).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    name: z.string().trim().max(200).optional(),
  })
  .refine(data => Boolean(data.identifier || data.email), {
    message: 'An email address or phone number is required',
    path: ['identifier'],
  })

export default defineEventHandler(async (event) => {
  // Caps automated account creation from one source.
  rateLimit(event, RateLimits.signup)

  const body = await validateBody(event, bodySchema)

  const parsed = parseIdentifier(body.identifier ?? body.email ?? '')
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Enter a valid email address or phone number' })
  }

  // Derive a display name: explicit fields first, then the single `name`,
  // then the email local-part, finally a neutral default for phone-only signups.
  const [nameFirst, ...nameRest] = (body.name ?? '').split(' ').filter(Boolean)
  const emailLocalPart = parsed.kind === 'email' ? parsed.email.split('@')[0] : undefined
  const firstName = body.firstName || nameFirst || emailLocalPart || 'Customer'
  const lastName = body.lastName || (nameRest.join(' ') || null)

  const existingUser = await prisma.user.findUnique({ where: identifierWhere(parsed) })
  if (existingUser) {
    const what = parsed.kind === 'email' ? 'email address' : 'phone number'
    throw createError({ statusCode: 409, message: `An account with this ${what} already exists` })
  }

  const hashedPassword = await bcrypt.hash(body.password, 10)

  const newUser = await prisma.user.create({
    data: {
      email: parsed.kind === 'email' ? parsed.email : null,
      phone: parsed.kind === 'phone' ? parsed.phone : null,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'CUSTOMER',
      avatar: '/img/avatars/placeholder.svg',
    },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true },
  })

  // Sign the new customer in straight away.
  const token = issueAuthToken(event, { id: newUser.id, email: newUser.email, role: newUser.role })
  setAuthCookie(event, token)

  return { status: 'success', user: newUser }
})
