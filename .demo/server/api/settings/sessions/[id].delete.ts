import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../utils/audit'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * DELETE /api/settings/sessions/:id — sign out one of the caller's other
 * devices. Its next request is refused by the session middleware. This
 * browser signs out with the account menu, so its own id is a 400.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (id === session.sid) {
    throw createError({ statusCode: 400, message: 'To sign out of this device, use Sign out in the account menu.' })
  }
  const { count } = await prisma.session.updateMany({
    where: { id, userId: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (!count) {
    throw createError({ statusCode: 404, message: 'That device is already signed out.' })
  }
  await recordAudit(event, session, { action: 'auth.session.revoked', targetType: 'Session', targetId: id })
  return { status: 'signed_out' }
})
