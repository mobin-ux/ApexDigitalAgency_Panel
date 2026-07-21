import { PaymentProviderError, type PaymentProvider } from './types'

/**
 * TrueLayer adapter — commercial Variable Recurring Payments (Pay by Bank).
 *
 * NOT ACTIVE. This is a deliberate, documented stub (ADR-015 §2.4).
 *
 * Why it exists now: UKPI — the UK's first new payment scheme since Faster
 * Payments in 2008 — went live on 2 June 2026, built on commercial VRP.
 * Versus Bacs Direct Debit it settles in seconds instead of days, costs a
 * flat few pence instead of ~£4, and the payer authorises it in their own
 * banking app with visible limits they can revoke in one click. For a
 * platform whose core product is multi-year installment plans, that is
 * where collection should end up.
 *
 * Why it is a stub: cVRP ecommerce use cases are still rolling out through
 * Wave 1, and switching the installment rail requires a mandate re-consent
 * campaign across every active customer — a product decision, not a
 * technical one.
 *
 * Because the whole payment layer is capability-routed (registry.ts), the
 * migration when that decision comes is: implement the methods below, set
 * `payments.provider.recurring = truelayer`, run the re-consent flow. No
 * call site changes.
 *
 * API reference: https://docs.truelayer.com/docs/vrp-integration-checklist
 */

function notImplemented(): never {
  throw new PaymentProviderError(
    'The TrueLayer VRP rail is not enabled yet. Route this capability to Stripe or GoCardless.',
    'truelayer',
    'provider_not_enabled',
    501,
  )
}

export function createTrueLayerProvider(): PaymentProvider {
  return {
    name: 'truelayer',
    // Empty on purpose: the registry will never route to a provider that
    // claims no capabilities, so a misconfiguration fails loudly at
    // resolution time rather than at charge time.
    capabilities: [],
    liveMode: false,

    createCharge: notImplemented,
    getCharge: notImplemented,
    verifyWebhook: notImplemented,
  }
}
