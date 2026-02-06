import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const { token, newPassword } = await readBody(event)

  // Auto-imported prisma usage
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token }
  })

  if (!resetToken || resetToken.expiresAt < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired token.' })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  
  await prisma.user.update({
    where: { email: resetToken.email },
    data: { password: hashedPassword }
  })

  // Burn the token
  await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })

  return { status: 'success', message: 'Password updated successfully.' }
})