import { defineEventHandler } from 'h3'
import { endSession } from '../../utils/auth'

/** POST /api/auth/logout — end this browser's session and clear the cookie. */
export default defineEventHandler(async (event) => {
  await endSession(event)
  return { status: 'success' }
})
