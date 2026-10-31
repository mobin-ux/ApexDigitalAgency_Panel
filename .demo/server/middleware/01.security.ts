import { createError, defineEventHandler, getRequestHeader, getRequestURL, setHeader, setHeaders } from 'h3'

/**
 * Global security middleware — response headers and cross-origin write
 * protection. Runs before every request (the `01.` prefix orders it ahead
 * of other server middleware).
 *
 * This deliberately does NOT do authentication: guards stay per-route
 * (`requireAuth`/`requireAdmin`) so an accidental gap is visible at the
 * handler rather than hidden in middleware ordering. See utils/auth.ts.
 */

/** Endpoints whose auth IS the signature, so no cookie is involved. */
const WEBHOOK_PREFIX = '/api/webhooks/'

/** Writes that legitimately arrive without an Origin (server-to-server). */
const CSRF_EXEMPT = [WEBHOOK_PREFIX]

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  // --- Response headers -----------------------------------------------------

  setHeaders(event, {
    // Stop MIME sniffing turning an upload into executable script.
    'X-Content-Type-Options': 'nosniff',
    // Legacy clickjacking defence; CSP frame-ancestors is the modern one.
    'X-Frame-Options': 'DENY',
    // Don't leak authenticated URLs (which contain ids) to third parties.
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Drop powerful features the app never uses.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'X-DNS-Prefetch-Control': 'off',
  })

  if (!import.meta.dev) {
    // 2 years + preload: the standard HSTS posture. Only meaningful over
    // HTTPS, which is why it is production-only.
    setHeader(event, 'Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // Never let an authenticated API response sit in a shared cache.
  if (path.startsWith('/api/')) {
    setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, private')
    setHeader(event, 'Pragma', 'no-cache')
  }

  // --- Content Security Policy ---------------------------------------------
  // Nuxt inlines its hydration payload and Shuriken UI sets inline styles, so
  // 'unsafe-inline' is required for script/style until a nonce pipeline
  // exists. Everything else is locked to same-origin, which is what actually
  // blocks injected third-party exfiltration. Dev additionally needs
  // 'unsafe-eval' and ws: for HMR.
  const scriptSrc = import.meta.dev
    ? '\'self\' \'unsafe-inline\' \'unsafe-eval\''
    : '\'self\' \'unsafe-inline\''
  const connectSrc = import.meta.dev
    ? '\'self\' ws: wss:'
    // Provider JS (Stripe Elements, PayPal SDK) calls back to these origins.
    : '\'self\' https://api.stripe.com https://api-m.paypal.com'

  setHeader(event, 'Content-Security-Policy', [
    'default-src \'self\'',
    `script-src ${scriptSrc} https://js.stripe.com https://www.paypal.com`,
    'style-src \'self\' \'unsafe-inline\'',
    'img-src \'self\' data: blob: https:',
    'font-src \'self\' data:',
    `connect-src ${connectSrc}`,
    // Provider payment UIs render in iframes — they must be allowed.
    'frame-src \'self\' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com',
    'frame-ancestors \'none\'',
    'base-uri \'self\'',
    'form-action \'self\'',
    'object-src \'none\'',
  ].join('; '))

  // --- CSRF: origin check on state-changing requests ------------------------
  // The session cookie is SameSite=Lax, which already blocks cross-site POSTs
  // from forms and fetch. This is defence in depth for the cases Lax does not
  // cover (some legacy browsers, and any future SameSite=None need).
  //
  // Checked against the request's own Host rather than a configured origin so
  // it keeps working across environments without more configuration.
  const method = event.method
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'

  if (isWrite && path.startsWith('/api/') && !CSRF_EXEMPT.some(p => path.startsWith(p))) {
    const origin = getRequestHeader(event, 'origin')

    // No Origin at all: non-browser client (curl, server-to-server, native
    // app). Those cannot be CSRF'd — CSRF requires a browser that attaches
    // cookies automatically, and every browser sends Origin on writes.
    if (origin) {
      let originHost: string
      try {
        originHost = new URL(origin).host
      }
      catch {
        throw createError({ statusCode: 403, message: 'Invalid origin' })
      }

      if (originHost !== url.host) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden',
          message: 'Cross-origin request rejected',
        })
      }
    }
  }
})
