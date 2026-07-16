import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/** POST /api/settings/password — change password after verifying the current one. */

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  // Kept at 6 to match the legacy Settings page's own validation;
  // align to 8 (signup/reset) when that page is redesigned.
  newPassword: z.string().min(6, 'Password too short'),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { currentPassword, newPassword } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) {
    throw createError({ statusCode: 403, message: 'Incorrect current password' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: session.id },
    data: { password: hashedPassword },
  })

  return { status: 'success', message: 'Password updated successfully' }
})
