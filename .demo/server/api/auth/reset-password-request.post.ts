import crypto from 'node:crypto'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/reset-password-request — start the reset flow.
 * Always answers success so the endpoint can't be used to probe which
 * emails have accounts.
 *
 * TODO(api): no mail provider is wired yet — the link is logged to the
 * server console (dev simulation).
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export default defineEventHandler(async (event) => {
  const { email } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { status: 'success', message: 'If the email exists, a link has been sent.' }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: { email, token, expiresAt, userId: user.id },
  })

  // Email simulation — replace with a real mail provider before production.
  console.warn(`[reset-password] simulated email to ${email}: /auth/recover?token=${token}`)

  return { status: 'success', message: 'If the email exists, a link has been sent.' }
})
