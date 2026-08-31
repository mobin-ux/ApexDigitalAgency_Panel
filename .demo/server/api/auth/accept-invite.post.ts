import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { isStaffRole } from '../../../shared/permissions'
import { recordAudit } from '../../utils/audit'
import { issueAuthToken, setAuthCookie } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/accept-invite — turn an invitation into a staff account.
 *
 * This is the only route in the app that can create an account with a
 * role other than CUSTOMER, and it can do so only because an existing
 * team member with `team.manage` already chose the address and the role.
 * Neither is accepted from the request body: both are read from the
 * invite row, so a crafted payload cannot pick its own privileges.
 *
 * The token is consumed inside the same transaction that creates the
 * account, so two simultaneous submissions cannot both succeed.
 */

const bodySchema = z.object({
  token: z.string().trim().min(16).max(200),
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
})

export default defineEventHandler(async (event) => {
  rateLimit(event, RateLimits.inviteAccept)
  const { token, password } = await validateBody(event, bodySchema)

  const invite = await prisma.staffInvite.findUnique({ where: { token } })
  if (!invite || invite.cancelledAt || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw createError({ statusCode: 400, message: 'This invitation is no longer valid. Ask whoever invited you to send a new one.' })
  }
  if (!isStaffRole(invite.role)) {
    throw createError({ statusCode: 400, message: 'This invitation is not valid. Ask whoever invited you to send a new one.' })
  }

  const clash = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })
  if (clash) {
    throw createError({ statusCode: 409, message: 'An account already exists for this address. Sign in instead.' })
  }

  const [nameFirst, ...nameRest] = invite.name.split(' ').filter(Boolean)
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.$transaction(async (tx) => {
    // Claim the invite conditionally: a second request racing this one
    // updates zero rows and is refused below, so one link makes one account.
    const claimed = await tx.staffInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, cancelledAt: null },
      data: { acceptedAt: new Date() },
    })
    if (claimed.count === 0) {
      throw createError({ statusCode: 409, message: 'This invitation has already been used.' })
    }

    return tx.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        firstName: nameFirst || invite.email.split('@')[0]!,
        lastName: nameRest.join(' ') || null,
        role: 'ADMIN',
        staffRole: invite.role,
        staffJoinedAt: new Date(),
        verifiedAt: new Date(),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, staffRole: true },
    })
  })

  await recordAudit(event, { id: user.id, email: user.email ?? invite.email, staffRole: invite.role }, {
    action: 'auth.invite.accept',
    targetType: 'User',
    targetId: user.id,
    subject: invite.name,
    metadata: { role: invite.role, invitedById: invite.invitedById },
  })

  const authToken = issueAuthToken(event, { id: user.id, email: user.email, role: user.role })
  setAuthCookie(event, authToken)

  return { status: 'success', user }
})
