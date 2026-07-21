import type { Capability, PaymentProvider, ProviderName } from './types'
import process from 'node:process'
import { useRuntimeConfig } from '#imports'
import { createLogger } from '../utils/logger'
import { getSetting } from '../utils/settings'
import { createGoCardlessProvider } from './gocardless'
import { createMockProvider } from './mock'
import { createPayPalProvider } from './paypal'
import { createStripeProvider } from './stripe'
import { createTrueLayerProvider } from './truelayer'
import { PaymentProviderError } from './types'

/**
 * Provider resolution (ADR-015 §4).
 *
 * Routing is per CAPABILITY, not per application: cards can go to Stripe
 * while direct debit goes to GoCardless in the same deployment, and moving
 * installments to TrueLayer later is a Setting change with no code edits.
 *
 * Two safety properties are enforced here and nowhere else:
 *  1. A provider with no credentials is never constructed — we fall back to
 *     `mock`, so a missing key cannot silently become a real charge.
 *  2. Live mode is refused unless the credentials are actually live keys AND
 *     the operator has flipped `payments.live-mode`. Sandbox is the default.
 */

const log = createLogger('payments:registry')

/** Which provider serves each capability, unless a Setting overrides it. */
const DEFAULT_ROUTES: Record<Capability, ProviderName> = {
  charge: 'stripe',
  mandate: 'gocardless',
  recurring: 'gocardless',
  refund: 'stripe',
  payout: 'stripe',
  bank_link: 'stripe',
}

const SETTING_KEYS: Record<Capability, string> = {
  charge: 'payments.provider.charge',
  mandate: 'payments.provider.mandate',
  recurring: 'payments.provider.recurring',
  refund: 'payments.provider.refund',
  payout: 'payments.provider.payout',
  bank_link: 'payments.provider.bank-link',
}

/** Built providers are cached per process — adapters are stateless. */
const cache = new Map<ProviderName, PaymentProvider | null>()

function build(name: ProviderName): PaymentProvider | null {
  const config = useRuntimeConfig()
  const payments = (config as any).payments ?? {}

  switch (name) {
    case 'stripe': {
      const secretKey = payments.stripe?.secretKey || process.env.NUXT_PAYMENTS_STRIPE_SECRET_KEY
      const webhookSecret = payments.stripe?.webhookSecret || process.env.NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET
      // The API key alone is enough to CHARGE. The webhook secret is only
      // needed to VERIFY callbacks, so a missing one must not silently
      // demote the whole rail to mock — that would look like the
      // integration failing. verifyWebhook throws its own clear error, and
      // plugins/startup-checks.ts still fails production closed on the
      // incomplete pair.
      if (!secretKey) {
        return null
      }
      if (!webhookSecret) {
        log.warn('Stripe is configured without a webhook secret — charges will work, but confirmations cannot be verified. Set NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET.')
      }
      return createStripeProvider({ secretKey, webhookSecret: webhookSecret ?? '' })
    }
    case 'gocardless': {
      const accessToken = payments.gocardless?.accessToken || process.env.NUXT_PAYMENTS_GOCARDLESS_ACCESS_TOKEN
      const webhookSecret = payments.gocardless?.webhookSecret || process.env.NUXT_PAYMENTS_GOCARDLESS_WEBHOOK_SECRET
      if (!accessToken || !webhookSecret) {
        return null
      }
      const environment = accessToken.startsWith('live_') ? 'live' as const : 'sandbox' as const
      return createGoCardlessProvider({ accessToken, webhookSecret, environment })
    }
    case 'paypal': {
      const clientId = payments.paypal?.clientId || process.env.NUXT_PAYMENTS_PAYPAL_CLIENT_ID
      const clientSecret = payments.paypal?.clientSecret || process.env.NUXT_PAYMENTS_PAYPAL_CLIENT_SECRET
      const webhookId = payments.paypal?.webhookId || process.env.NUXT_PAYMENTS_PAYPAL_WEBHOOK_ID
      if (!clientId || !clientSecret || !webhookId) {
        return null
      }
      const environment = (payments.paypal?.environment || process.env.NUXT_PAYMENTS_PAYPAL_ENV) === 'live' ? 'live' as const : 'sandbox' as const
      return createPayPalProvider({ clientId, clientSecret, webhookId, environment })
    }
    case 'truelayer':
      return createTrueLayerProvider()
    case 'mock':
      return createMockProvider()
  }
}

/** Get a provider by name, or null when it has no credentials configured. */
export function getProviderByName(name: ProviderName): PaymentProvider | null {
  if (!cache.has(name)) {
    const provider = build(name)
    cache.set(name, provider)
    if (!provider && name !== 'mock') {
      log.warn('provider has no credentials — not available', { provider: name })
    }
  }
  return cache.get(name) ?? null
}

/**
 * Resolve the provider that serves `capability`.
 *
 * Falls back to `mock` when the configured provider is unavailable, so the
 * application keeps working without credentials. Throws only when even the
 * fallback cannot serve the capability, which would be a code bug.
 */
export async function getProvider(capability: Capability): Promise<PaymentProvider> {
  const configured = await getSetting<ProviderName>(SETTING_KEYS[capability], DEFAULT_ROUTES[capability])
  const provider = getProviderByName(configured)

  if (provider && provider.capabilities.includes(capability)) {
    await assertModeIsSafe(provider)
    return provider
  }

  if (provider && !provider.capabilities.includes(capability)) {
    log.warn('configured provider cannot serve capability — falling back', { capability, configured })
  }

  const fallback = getProviderByName('mock')
  if (!fallback) {
    throw new PaymentProviderError(`No provider available for ${capability}`, 'mock', 'no_provider', 500)
  }
  log.info('using mock provider', { capability, reason: provider ? 'capability_mismatch' : 'no_credentials' })
  return fallback
}

/**
 * Refuse to move real money unless the operator explicitly enabled live mode.
 * A live secret key left in a staging .env is otherwise indistinguishable
 * from an intentional production deploy.
 */
async function assertModeIsSafe(provider: PaymentProvider): Promise<void> {
  if (!provider.liveMode) {
    return
  }
  const liveEnabled = await getSetting<boolean>('payments.live-mode', false)
  if (!liveEnabled) {
    throw new PaymentProviderError(
      `${provider.name} is configured with LIVE credentials but payments.live-mode is off. `
      + 'Enable it in Admin → Settings only when you intend to process real money.',
      provider.name,
      'live_mode_disabled',
      503,
    )
  }
}

/** Every provider that currently has usable credentials — for the admin UI. */
export function availableProviders(): Array<{ name: ProviderName, capabilities: readonly Capability[], liveMode: boolean }> {
  const names: ProviderName[] = ['stripe', 'gocardless', 'paypal', 'truelayer', 'mock']
  return names
    .map(name => getProviderByName(name))
    .filter((p): p is PaymentProvider => Boolean(p) && (p as PaymentProvider).capabilities.length > 0)
    .map(p => ({ name: p.name, capabilities: p.capabilities, liveMode: p.liveMode }))
}

/** Test seam — adapters are cached per process. */
export function resetProviderCache(): void {
  cache.clear()
}
