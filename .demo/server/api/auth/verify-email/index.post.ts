import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { readPurposeToken } from '../../../utils/auth'
import { VERIFY_EMAIL_PURPOSE } from '../../../utils/mail/flows'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { validateBody } from '../../../utils/validate'

const bodySchema = z.object({
  token: z.string().trim().min(1).max(2000),
})

/**
 * POST /api/auth/verify-email — the link from the verification email.
 *
 * The token is a purpose JWT (`verify-email`, 24 hours) naming the account
 * and the address it was issued for, so a link for an address the account
 * no longer has cannot confirm the new one. Needs no session: the person
 * may open the link in another browser. Idempotent — a second click is
 * still a success, because the address is still confirmed.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, RateLimits.inviteAccept)
  const { token } = await validateBody(event, bodySchema)

  const claims = readPurposeToken(event, token, VERIFY_EMAIL_PURPOSE)
  const uid = claims && typeof claims.uid === 'string' ? claims.uid : null
  const email = claims && typeof claims.email === 'string' ? claims.email : null
  if (!uid || !email) {
    throw createError({ statusCode: 400, message: 'This link is not valid or has expired. Ask for a new one from the panel.' })
  }

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, email: true, verifiedAt: true } })
  if (!user || user.email !== email) {
    throw createError({ statusCode: 400, message: 'This link is for a different email address than the one on the account.' })
  }
  if (user.verifiedAt) {
    return { status: 'success', verified: true, already: true }
  }

  const updated = await prisma.user.updateMany({ where: { id: uid, email, verifiedAt: null }, data: { verifiedAt: new Date() } })
  if (updated.count > 0) {
    await recordAudit(event, { id: uid, email }, { action: 'auth.email.verify', targetType: 'User', targetId: uid, metadata: { email } })
  }
  return { status: 'success', verified: true, already: updated.count === 0 }
})
