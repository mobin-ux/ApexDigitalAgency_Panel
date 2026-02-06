import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  // Auto-imported prisma client
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    return { status: 'success', message: 'If the email exists, a link has been sent.' }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 3600000) // 1 hour

await prisma.passwordResetToken.create({
    data: {
      email,
      token,
      expiresAt,
      userId: user.id // <--- این خط باید اضافه شود
    }
  })

  // Simulation log
  console.log('\n====================================')
  console.log('📧 EMAIL SIMULATION:')
  console.log(`To: ${email}`)
  // Adjust domain if needed
  console.log(`Link: http://91.212.174.36:3000/auth/recover?token=${token}`) 
  console.log('====================================\n')

  return { status: 'success', message: 'Reset link sent.' }
})