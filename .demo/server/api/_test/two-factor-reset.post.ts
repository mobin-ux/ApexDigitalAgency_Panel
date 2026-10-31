import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * Removes one account's two-step verification. Dev-only, like the seed
 * routes: the staff sign-in requires an authenticator code (ADR-025), and
 * the API test harness enrols each staff account it uses and keeps the
 * secret in `.data`. When that file and the local database disagree, the
 * harness clears the account here and enrols it again. Does not exist in a
 * production build.
 */
const bodySchema = z.object({ email: z.string().trim().toLowerCase().email() }).strict()

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const { email } = await validateBody(event, bodySchema)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    throw createError({ statusCode: 404, message: 'No account with that address' })
  }
  const { count } = await prisma.twoFactor.deleteMany({ where: { userId: user.id } })
  return { ok: true, removed: count }
})
