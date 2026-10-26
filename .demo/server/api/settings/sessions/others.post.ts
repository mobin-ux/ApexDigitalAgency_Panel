import { defineEventHandler } from 'h3'
import { recordAudit } from '../../../utils/audit'
import { endOtherSessions, requireAuth, startSession } from '../../../utils/auth'

/**
 * POST /api/settings/sessions/others — sign out of every device but this one,
 * including any still on a token from before sessions were recorded. If this
 * browser is one of those, it gets a fresh session so it stays signed in.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const count = await endOtherSessions(session.id, session.sid)
  if (!session.sid) {
    await startSession(event, session)
  }
  await recordAudit(event, session, { action: 'auth.session.revoked_others', targetType: 'User', targetId: session.id, metadata: { count } })
  return { status: 'signed_out', count }
})
