import type { H3Event } from 'h3'
import { createError, getRequestHeader, getRequestIP, setHeader } from 'h3'
import { createLogger } from './logger'

/**
 * Sliding-window rate limiting.
 *
 * Storage is in-process: correct and fast for a single Nitro instance,
 * which is what this platform runs today. Behind multiple instances each
 * would keep its own window, so the effective limit multiplies by the
 * instance count — the fix is swapping `store` for Redis/Upstash behind
 * the same interface, NOT changing any call site. Documented rather than
 * pre-built because an unused Redis dependency is its own liability.
 *
 * Limits are per (bucket, identity). Identity is the authenticated user
 * when there is one, otherwise the client IP.
 */

const log = createLogger('ratelimit')

interface Window {
  hits: number[]
  /** Set when a caller has been temporarily blocked for abuse. */
  blockedUntil?: number
}

const store = new Map<string, Window>()

/** Stop the map growing without bound on a long-lived process. */
let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < 60_000) {
    return
  }
  lastSweep = now
  for (const [key, window] of store) {
    const fresh = window.hits.filter(t => now - t < 3_600_000)
    if (fresh.length === 0 && (!window.blockedUntil || window.blockedUntil < now)) {
      store.delete(key)
    }
    else {
      window.hits = fresh
    }
  }
}

export interface RateLimitOptions {
  /** Namespace, so the same identity gets independent budgets per action. */
  bucket: string
  /** Requests allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
  /**
   * When set, exceeding the limit blocks the identity for this long instead
   * of just rejecting the request. Used on credential endpoints so a
   * password-spray attempt gets progressively more expensive.
   */
  blockMs?: number
  /** Override the identity (defaults to user id, else IP). */
  identity?: string
}

/**
 * Client IP, trusting `x-forwarded-for` only for its FIRST entry. Later
 * entries are attacker-controllable when the app sits behind one proxy.
 */
export function clientIp(event: H3Event): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) {
      return first
    }
  }
  return getRequestIP(event, { xForwardedFor: false }) || 'unknown'
}

/**
 * Consume one unit from the bucket. Throws 429 with `Retry-After` when the
 * budget is spent; sets `X-RateLimit-*` headers on every call so clients
 * can back off before being rejected.
 */
export function rateLimit(event: H3Event, options: RateLimitOptions): void {
  const now = Date.now()
  sweep(now)

  const identity = options.identity ?? event.context.auth?.id ?? clientIp(event)
  const key = `${options.bucket}:${identity}`

  const window = store.get(key) ?? { hits: [] }

  if (window.blockedUntil && window.blockedUntil > now) {
    const retryAfter = Math.ceil((window.blockedUntil - now) / 1000)
    // h3 types Retry-After as numeric seconds, not a string.
    setHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `Too many attempts. Try again in ${retryAfter} seconds.`,
    })
  }

  window.hits = window.hits.filter(t => now - t < options.windowMs)

  const remaining = options.limit - window.hits.length - 1
  setHeader(event, 'X-RateLimit-Limit', String(options.limit))
  setHeader(event, 'X-RateLimit-Remaining', String(Math.max(0, remaining)))

  if (window.hits.length >= options.limit) {
    if (options.blockMs) {
      window.blockedUntil = now + options.blockMs
    }
    store.set(key, window)

    const retryAfter = Math.ceil(
      (options.blockMs ?? options.windowMs - (now - window.hits[0]!)) / 1000,
    )
    setHeader(event, 'Retry-After', retryAfter)
    log.warn('rate limit exceeded', { bucket: options.bucket, identity, limit: options.limit })

    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `Too many requests. Try again in ${retryAfter} seconds.`,
    })
  }

  window.hits.push(now)
  store.set(key, window)
}

/**
 * Named presets so limits are consistent and reviewable in one place
 * rather than scattered as magic numbers across handlers.
 */
export const RateLimits = {
  /** Credential endpoints: slow, and abuse locks the identity out. */
  login: { bucket: 'auth:login', limit: 5, windowMs: 60_000, blockMs: 15 * 60_000 },
  signup: { bucket: 'auth:signup', limit: 3, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  passwordReset: { bucket: 'auth:reset', limit: 3, windowMs: 15 * 60_000, blockMs: 30 * 60_000 },
  /** Anything that moves money or calls a paid provider API. */
  payment: { bucket: 'payment', limit: 10, windowMs: 60_000 },
  /** Writes in general — generous, catches runaway clients not attackers. */
  mutation: { bucket: 'mutation', limit: 60, windowMs: 60_000 },
  /** Ticket/message creation, to blunt spam. */
  support: { bucket: 'support', limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitOptions>

/** Test seam. */
export function resetRateLimits(): void {
  store.clear()
}
