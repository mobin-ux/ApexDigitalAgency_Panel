import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { avatarUrl } from '../../../shared/avatar'
import { requireAuth } from '../../utils/auth'
import { log } from '../../utils/logger'
import prisma from '../../utils/prisma'
import { sendAttachment, uploadDir } from '../../utils/uploads'

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
  // The record outlived its file (a restore without the uploads directory, a
  // hand clean-up). Every page asked for it and got a 404 behind the initials
  // (AUD-11), so the account goes back to having no photo, which it already
  // shows, and the next page load does not ask again.
  if (!await stat(join(uploadDir(), photo.path)).then(() => true, () => false)) {
    await prisma.$transaction([
      prisma.user.updateMany({ where: { id: photo.avatarUserId!, avatar: avatarUrl(photo.avatarUserId!, photo.id) }, data: { avatar: null } }),
      prisma.attachment.update({ where: { id: photo.id }, data: { avatarUserId: null } }),
    ])
    log('customer').warn('avatar.file-missing', 'A profile photo\'s file is not on disk; the account is back to initials', { outcome: 'failure', data: { userId: photo.avatarUserId, attachmentId: photo.id } })
    throw createError({ statusCode: 404, message: 'No photo' })
  }
  return sendAttachment(event, photo, { inline: true, cache: 'private, max-age=31536000, immutable' })
})
