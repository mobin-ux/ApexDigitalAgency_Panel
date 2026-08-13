import type { Capability, ProviderName } from '../../payments/types'
import { defineEventHandler } from 'h3'
import { getProviderByName } from '../../payments/registry'
import { requireAuth } from '../../utils/auth'
import { getSetting } from '../../utils/settings'

/**
 * GET /api/finance/pay-config — everything the Top-Up / Add-Payment-Method UI
 * needs to render the correct, honest flow.
 *
 * The single most important thing it reports is `cardEntry` / `bankEntry`:
 *
 *   'hosted' — a real provider (Stripe / GoCardless) is connected, so card and
 *              bank details MUST be collected on the provider's own hosted page
 *              (PCI DSS SAQ-A). The UI launches that flow; our servers never
 *              see a PAN, sort code or account number.
 *   'inline' — no real provider is configured, so the app is on the sandbox
 *              (mock) rail. The UI renders our own fully-validated UK forms and
 *              the payment settles end-to-end against the mock provider. Real
 *              money is never moved. Even here the full card number and CVC are
 *              kept in the browser and never persisted.
 *
 * This is what keeps "add a card" both real and compliant regardless of whether
 * live credentials are present.
 */

// Mirrors registry.ts DEFAULT_ROUTES for the two capabilities the wallet uses.
const DEFAULTS: Partial<Record<Capability, ProviderName>> = { charge: 'stripe', mandate: 'gocardless' }
const SETTING_KEY: Partial<Record<Capability, string>> = {
  charge: 'payments.provider.charge',
  mandate: 'payments.provider.mandate',
}

async function resolve(capability: 'charge' | 'mandate') {
  const configured = await getSetting<ProviderName>(SETTING_KEY[capability]!, DEFAULTS[capability]!)
  const provider = getProviderByName(configured)
  if (provider && provider.capabilities.includes(capability)) {
    return provider
  }
  // Same fallback the registry uses when a provider has no credentials.
  return getProviderByName('mock')
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const [chargeProvider, mandateProvider, liveEnabled, topupMin, topupMax, ddNoticeDays] = await Promise.all([
    resolve('charge'),
    resolve('mandate'),
    getSetting<boolean>('payments.live-mode', false),
    getSetting<number>('finance.topup-min', 5),
    getSetting<number>('finance.topup-max', 25_000),
    getSetting<number>('finance.direct-debit-notice-days', 3),
  ])

  const chargeIsMock = !chargeProvider || chargeProvider.name === 'mock'
  const mandateIsMock = !mandateProvider || mandateProvider.name === 'mock'
  const liveMode = Boolean(chargeProvider?.liveMode && liveEnabled)

  // Publishable key — designed to be public; it is what Stripe Elements needs
  // in the browser to render the hosted card fields. NEVER the secret key.
  const { useRuntimeConfig } = await import('#imports')
  const publishableKey = (useRuntimeConfig() as any).public?.payments?.stripePublishableKey || ''

  // Hosted entry needs BOTH a real provider and a publishable key. Without the
  // key Elements cannot mount, so say so plainly rather than rendering a card
  // form that could never work.
  const cardEntry = chargeIsMock ? 'inline' : (publishableKey ? 'hosted' : 'unavailable')

  return {
    currency: 'GBP',
    // Sandbox = no real money will move. Surfaced as a badge so nobody mistakes
    // a completed sandbox top-up for a real charge.
    sandbox: !liveMode,
    liveMode,
    topupMin,
    topupMax,
    card: {
      enabled: cardEntry !== 'unavailable',
      entry: cardEntry,
      publishableKey: cardEntry === 'hosted' ? publishableKey : '',
      brands: ['visa', 'mastercard', 'amex'],
    },
    directDebit: {
      enabled: Boolean(mandateProvider),
      entry: mandateIsMock ? 'inline' : 'hosted',
      advanceNoticeDays: ddNoticeDays,
    },
  }
})
