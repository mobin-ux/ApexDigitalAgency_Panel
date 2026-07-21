import process from 'node:process'
import { useRuntimeConfig } from '#imports'
import { defineNitroPlugin } from 'nitropack/runtime'
import { createLogger } from '../utils/logger'

/**
 * Boot-time configuration validation.
 *
 * A misconfigured production deploy should fail loudly at startup, not
 * quietly at 2am when someone's payment goes through on a test key or a
 * session is forged against the fallback JWT secret. Development is only
 * warned — local work must stay zero-config.
 */

const log = createLogger('startup')

interface Check {
  name: string
  /** Fatal checks abort the process in production. */
  fatal: boolean
  failed: boolean
  message: string
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  const payments = (config as any).payments ?? {}
  const checks: Check[] = []

  // --- Secrets -------------------------------------------------------------

  const jwtSecret = config.jwtSecret
  checks.push({
    name: 'jwt-secret',
    fatal: true,
    failed: !jwtSecret || jwtSecret === 'secret',
    message: 'NUXT_JWT_SECRET is unset or still the development fallback. Anyone can forge a session. Generate one with `openssl rand -hex 32`.',
  })

  checks.push({
    name: 'jwt-secret-strength',
    fatal: false,
    failed: Boolean(jwtSecret) && jwtSecret !== 'secret' && jwtSecret.length < 32,
    message: 'NUXT_JWT_SECRET is shorter than 32 characters — use at least 32 bytes of randomness.',
  })

  checks.push({
    name: 'encryption-key',
    fatal: false,
    failed: !process.env.NUXT_ENCRYPTION_KEY,
    message: 'NUXT_ENCRYPTION_KEY is unset — field encryption falls back to the JWT secret, so one leaked value compromises both sessions and stored data.',
  })

  checks.push({
    name: 'site-url',
    fatal: false,
    failed: !config.public?.siteUrl,
    message: 'NUXT_PUBLIC_SITE_URL is unset — payment provider return URLs and webhook callbacks may be built incorrectly.',
  })

  // --- Payment credentials -------------------------------------------------
  // A live key present with an incomplete pair is the dangerous shape: half
  // configured means charges may succeed while webhooks are never verified.

  const stripeKey = payments.stripe?.secretKey || process.env.NUXT_PAYMENTS_STRIPE_SECRET_KEY
  const stripeWebhook = payments.stripe?.webhookSecret || process.env.NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET
  checks.push({
    name: 'stripe-pairing',
    fatal: true,
    failed: Boolean(stripeKey) && !stripeWebhook,
    message: 'A Stripe secret key is set but NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET is missing. Payments would succeed with no verified confirmation path.',
  })

  const gcToken = payments.gocardless?.accessToken || process.env.NUXT_PAYMENTS_GOCARDLESS_ACCESS_TOKEN
  const gcWebhook = payments.gocardless?.webhookSecret || process.env.NUXT_PAYMENTS_GOCARDLESS_WEBHOOK_SECRET
  checks.push({
    name: 'gocardless-pairing',
    fatal: true,
    failed: Boolean(gcToken) && !gcWebhook,
    message: 'A GoCardless access token is set but NUXT_PAYMENTS_GOCARDLESS_WEBHOOK_SECRET is missing. Direct debit outcomes would never be recorded.',
  })

  checks.push({
    name: 'live-keys-in-dev',
    fatal: false,
    failed: Boolean(import.meta.dev) && (String(stripeKey).startsWith('sk_live_') || String(gcToken).startsWith('live_')),
    message: 'LIVE payment credentials are present in a development environment. Use sandbox keys locally.',
  })

  // --- Report --------------------------------------------------------------

  const failures = checks.filter(c => c.failed)
  if (failures.length === 0) {
    log.info('startup checks passed', { checked: checks.length })
    return
  }

  const fatal = failures.filter(c => c.fatal)

  for (const check of failures) {
    const level = check.fatal && !import.meta.dev ? 'error' : 'warn'
    log[level](`[${check.name}] ${check.message}`)
  }

  if (fatal.length > 0 && !import.meta.dev) {
    log.error('refusing to start with fatal configuration errors', { count: fatal.length })
    // Failing closed is the whole point: a production process that boots
    // with a forgeable session secret is worse than one that does not boot.
    process.exit(1)
  }
})
