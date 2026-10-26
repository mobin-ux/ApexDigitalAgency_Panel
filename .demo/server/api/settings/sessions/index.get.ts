import { defineEventHandler } from 'h3'
import { describeDevice } from '../../../../shared/device'
import { requireAuth, startSession } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/settings/sessions — the caller's signed-in devices, newest first.
 *
 * A browser still holding a token from before sessions were recorded has no
 * row, so it would be missing from its own list. It is given one here: a
 * fresh session and cookie, issued from this one request rather than from the
 * per-request middleware, where a page's parallel calls would each make one.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  let current = session.sid
  if (!current) {
    current = await startSession(event, session)
  }
  const rows = await prisma.session.findMany({
    where: { userId: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
  })
  const sessions = rows
    .map(r => ({ id: r.id, ...describeDevice(r.userAgent), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, current: r.id === current }))
    .sort((a, b) => Number(b.current) - Number(a.current))
  return { sessions }
})
