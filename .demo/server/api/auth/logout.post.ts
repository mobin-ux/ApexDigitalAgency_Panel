import { defineEventHandler } from 'h3'
import { clearAuthCookie } from '../../utils/auth'

/** POST /api/auth/logout — clear the session cookie. */
export default defineEventHandler((event) => {
  clearAuthCookie(event)
  return { status: 'success' }
})
