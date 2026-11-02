import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { PASSWORD_MIN } from '../../../shared/password'
import { startSession } from '../../utils/auth'
import { identifierWhere, parseIdentifier } from '../../utils/identifier'
import { log } from '../../utils/logger'
import { queueVerificationMail } from '../../utils/mail/flows'
import { deliverNow } from '../../utils/mail/outbox'
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
    password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(200),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    name: z.string().trim().max(200).optional(),
  })
  .refine(data => Boolean(data.identifier || data.email), {
    message: 'An email address or phone number is required',
    path: ['identifier'],
  })

export default defineEventHandler(async (event) => {
  // A generous per-address budget: a real person signs up at once, but each
  // signup can send a verification email to any address typed, so an
  // unlimited endpoint is a way to mail strangers and fill the user table.
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
    },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, role: true },
  })

  // Sign the new customer in straight away.
  await startSession(event, { id: newUser.id, email: newUser.email, role: newUser.role })

  // Soft verification (ADR-022): the account works now; the link sets
  // `verifiedAt` and the panel's banner asks until it is clicked. A phone-
  // only account has no address to confirm. The account exists whatever
  // happens to the email, so a queue failure is logged, not thrown.
  if (newUser.email) {
    try {
      const { id } = await queueVerificationMail(event, { id: newUser.id, email: newUser.email, firstName: newUser.firstName })
      void deliverNow([id])
    }
    catch (error) {
      log('mail').error('mail.verification.queue-failed', 'Could not queue the verification email', { outcome: 'failure', error })
    }
  }

  log('auth').info('auth.signup', `New customer account by ${parsed.kind}`, { outcome: 'success', data: { userId: newUser.id, identifierKind: parsed.kind } })
  return { status: 'success', user: newUser }
})
