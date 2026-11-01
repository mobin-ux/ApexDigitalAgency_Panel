import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { isStaffRole, ROLES } from '../../../shared/permissions'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'

/**
 * GET /api/auth/invite?token= — what an acceptance link is for.
 *
 * Unauthenticated by necessity: the invited person has no account yet.
 * The token is the credential, so this returns only what the acceptance
 * form must show — the name and role that were offered, and the address
 * the account will be created against. It never returns the token, the
 * inviter's details, or anything about other staff.
 *
 * Rate-limited on its own bucket rather than the password-reset one:
 * this runs on every load of the acceptance page, and a reset-sized
 * limit of three would lock a new hire out for half an hour merely for
 * refreshing.
 */

const querySchema = z.object({ token: z.string().trim().min(16).max(200) })

export default defineEventHandler(async (event) => {
  rateLimit(event, RateLimits.inviteRead)

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'This invitation link is not valid.' })
  }

  const invite = await prisma.staffInvite.findUnique({
    where: { token: parsed.data.token },
    select: { name: true, email: true, role: true, expiresAt: true, acceptedAt: true, cancelledAt: true },
  })

  if (!invite || invite.cancelledAt) {
    throw createError({ statusCode: 404, message: 'This invitation is no longer valid. Ask whoever invited you to send a new one.' })
  }
  if (invite.acceptedAt) {
    throw createError({ statusCode: 409, message: 'This invitation has already been used. Sign in with the password you chose.' })
  }
  if (invite.expiresAt < new Date()) {
    throw createError({ statusCode: 410, message: 'This invitation expired. Ask whoever invited you to resend it.' })
  }

  return {
    name: invite.name,
    email: invite.email,
    role: isStaffRole(invite.role) ? ROLES[invite.role].label : invite.role,
    covers: isStaffRole(invite.role) ? ROLES[invite.role].covers : null,
    expiresAt: invite.expiresAt,
  }
})
