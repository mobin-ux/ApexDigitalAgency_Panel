import bcrypt from 'bcryptjs'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { issueAuthToken, setAuthCookie } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/auth/login — verify credentials, set the session cookie.
 * The 401 message is identical for "unknown email" and "wrong password"
 * so the endpoint can't be used to enumerate accounts. The JWT lives
 * only in the cookie — it is never returned in the response body.
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { email, password } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUnique({ where: { email } })
  const passwordValid = user ? await bcrypt.compare(password, user.password) : false
  if (!user || !passwordValid) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  const token = issueAuthToken(event, user)
  setAuthCookie(event, token)

  const { password: _password, ...userWithoutPassword } = user
  return { status: 'success', user: userWithoutPassword }
})
