import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { logActivity } from '../../utils/logger'
import prisma from '../../utils/prisma'
import { deleteAttachments } from '../../utils/uploads'

/** DELETE /api/settings/avatar — remove the profile photo; initials show again. */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const photo = await prisma.attachment.findUnique({ where: { avatarUserId: session.id }, select: { id: true, path: true } })
  await prisma.user.update({ where: { id: session.id }, data: { avatar: null } })
  if (photo) {
    await deleteAttachments([photo])
  }
  logActivity('customer.settings.avatar-removed', 'Customer removed their profile photo')
  return { avatar: null }
})
