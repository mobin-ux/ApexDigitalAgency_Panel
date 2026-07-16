import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/settings/get-all — the caller's full profile + company.
 * The password hash is stripped before the record leaves the server
 * (the previous version returned it to the client).
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { company: true },
  })

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  const { password: _password, ...userWithoutPassword } = user
  return { user: userWithoutPassword }
})
