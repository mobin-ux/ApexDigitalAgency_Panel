import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { endOtherSessions } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/** POST /api/auth/reset-password-confirm — finish the reset flow and burn the token. */

const bodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export default defineEventHandler(async (event) => {
  const { token, newPassword } = await validateBody(event, bodySchema)

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw createError({ statusCode: 400, message: 'Invalid or expired token' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
      select: { id: true },
    }),
    // Burn the token — single use.
    prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
  ])
  // Whoever knew the old password may be signed in somewhere: a reset is the
  // moment to end every session, which Settings' own password change does not.
  await endOtherSessions(user.id, null)

  return { status: 'success', message: 'Password updated successfully.' }
})
