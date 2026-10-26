import { defineEventHandler } from 'h3'
import { clearAuthCookie, readAuthToken } from '../utils/auth'
import prisma from '../utils/prisma'

/**
 * Signed-in devices (Settings › Security). A JWT stays valid for seven days
 * whatever happens, so "Sign out" on another device has to be checked here:
 * once per API request, a token whose session row is revoked, expired or gone
 * is marked `authRevoked` and its cookie cleared. `getAuthSession` then sees
 * no session and every guard answers 401 as it would for no cookie at all.
 *
 * A token from before sessions were recorded has no row; it is refused once
 * it was issued before the account's `sessionsValidAfter` ("Sign out of all
 * other devices", a password reset) and otherwise lives out its seven days.
 *
 * Only `/api/` — pages read the session through `/api/auth/me`, which comes
 * through here too. Last seen is written at most every five minutes.
 */
const SEEN_EVERY_MS = 5 * 60_000

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/') || event.path.startsWith('/api/webhooks/')) {
    return
  }
  const claims = readAuthToken(event)
  if (!claims) {
    return
  }
  const now = Date.now()
  if (claims.sid) {
    const row = await prisma.session.findUnique({
      where: { id: claims.sid },
      select: { userId: true, revokedAt: true, expiresAt: true, lastSeenAt: true },
    })
    if (!row || row.userId !== claims.id || row.revokedAt || row.expiresAt.getTime() < now) {
      event.context.authRevoked = true
      clearAuthCookie(event)
      return
    }
    if (now - row.lastSeenAt.getTime() > SEEN_EVERY_MS) {
      await prisma.session.update({ where: { id: claims.sid }, data: { lastSeenAt: new Date(now) } })
    }
    return
  }
  const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { sessionsValidAfter: true } })
  if (user?.sessionsValidAfter && claims.iat * 1000 < user.sessionsValidAfter.getTime()) {
    event.context.authRevoked = true
    clearAuthCookie(event)
  }
})
