import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { sendAttachment } from '../../utils/uploads'

/**
 * GET /api/avatars/:userId — a profile photo, for the account itself and for
 * Apex staff ("Shown to your Apex team"). Nobody else: customers never see
 * each other, and a missing photo and a forbidden one are the same 404.
 *
 * Served inline with a year's private cache, because `User.avatar` carries
 * `?v=<file id>` and a new photo is therefore a new URL.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const userId = getRouterParam(event, 'userId')
  let allowed = userId === session.id
  if (!allowed) {
    const viewer = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true, status: true } })
    allowed = viewer?.role === 'ADMIN' && viewer.status !== 'SUSPENDED'
  }
  const photo = allowed && userId ? await prisma.attachment.findUnique({ where: { avatarUserId: userId } }) : null
  if (!photo) {
    throw createError({ statusCode: 404, message: 'No photo' })
  }
  return sendAttachment(event, photo, { inline: true, cache: 'private, max-age=31536000, immutable' })
})
