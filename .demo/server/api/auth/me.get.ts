import { defineEventHandler } from 'h3'
import { getAuthSession } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/auth/me — resolve the cookie to a fresh user record.
 * Returns `{ user: null }` (not a 401) for anonymous/invalid sessions:
 * the client boot plugin calls this unconditionally to hydrate state.
 */
export default defineEventHandler(async (event) => {
  const session = getAuthSession(event)
  if (!session) {
    return { user: null }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      // Which of the six staff roles this account holds inside the admin
      // panel (Phase 9 Admin). Null for customers. The client uses it only
      // to decide what to render; every endpoint re-checks it server-side.
      staffRole: true,
      avatar: true,
      adCredits: true,
    },
  })

  return { user: user ?? null }
})
