import { createError, defineEventHandler } from 'h3'
import { resetRateLimits } from '../../utils/ratelimit'

/**
 * Clears the in-process rate limiter. Dev-only, like the seed routes: the
 * API test suites sign in as every staff role from one address, which the
 * sign-in limiter (five a minute, then a fifteen-minute block) is built to
 * refuse. Does not exist in a production build.
 */
export default defineEventHandler(() => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  resetRateLimits()
  return { ok: true }
})
