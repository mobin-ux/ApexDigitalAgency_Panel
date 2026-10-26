import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { AVATAR_MAX_BYTES, AVATAR_MIMES, avatarUrl } from '../../../shared/avatar'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { deleteAttachments, unclaimedBy } from '../../utils/uploads'
import { validateBody } from '../../utils/validate'

/**
 * PUT /api/settings/avatar — make one of the caller's own unclaimed uploads
 * their profile photo. The file arrives through `POST /api/uploads` like every
 * other upload; this only claims it, so there is one place files are stored
 * and checked. The previous photo, if any, is deleted from disk.
 */
const bodySchema = z.object({ fileId: z.string().uuid() }).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { fileId } = await validateBody(event, bodySchema)

  const file = await prisma.attachment.findFirst({ where: { id: fileId, ...unclaimedBy(session.id) }, select: { id: true, mime: true, size: true } })
  if (!file) {
    throw createError({ statusCode: 404, message: 'That upload was not found. Choose the photo again.' })
  }
  if (!AVATAR_MIMES.includes(file.mime)) {
    throw createError({ statusCode: 415, message: 'Use a JPG, PNG, WebP or GIF image for your photo.' })
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw createError({ statusCode: 413, message: 'Use a photo under 5 MB.' })
  }

  const previous = await prisma.attachment.findUnique({ where: { avatarUserId: session.id }, select: { id: true, path: true } })
  const avatar = avatarUrl(session.id, file.id)
  await prisma.$transaction([
    ...(previous ? [prisma.attachment.update({ where: { id: previous.id }, data: { avatarUserId: null } })] : []),
    prisma.attachment.update({ where: { id: file.id }, data: { avatarUserId: session.id } }),
    prisma.user.update({ where: { id: session.id }, data: { avatar } }),
  ])
  if (previous) {
    await deleteAttachments([previous])
  }
  return { avatar }
})
