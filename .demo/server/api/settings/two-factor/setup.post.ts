import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '../../../utils/auth'
import { encryptField } from '../../../utils/crypto'
import prisma from '../../../utils/prisma'
import { newTotpSecret, otpauthUri } from '../../../utils/totp'

/**
 * POST /api/settings/two-factor/setup — start turning two-step on: a new
 * secret, kept as `pending` until a code from the app proves it was added
 * (`enable`). Calling it again replaces the pending secret, so an abandoned
 * setup leaves nothing that works.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const existing = await prisma.twoFactor.findUnique({ where: { userId: session.id }, select: { enabledAt: true } })
  if (existing?.enabledAt) {
    throw createError({ statusCode: 409, message: 'Two-step verification is already on.' })
  }
  const user = await prisma.user.findUnique({ where: { id: session.id }, select: { email: true, phone: true } })
  const secret = newTotpSecret()
  const pending = encryptField(secret)
  await prisma.twoFactor.upsert({
    where: { userId: session.id },
    create: { userId: session.id, pending },
    update: { pending },
  })
  return { secret, uri: otpauthUri(secret, user?.email ?? user?.phone ?? 'Apex account') }
})
