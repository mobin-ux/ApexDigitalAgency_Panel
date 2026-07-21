import type { ChargeResult, CreateChargeInput, IntentStatus, NormalisedEvent, PaymentProvider, ProviderBalance, RefundInput, RefundResult } from './types'
import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createLogger } from '../utils/logger'
import { formEncode, providerFetch } from './client'
import {

  PaymentProviderError,

  WebhookSignatureError,
} from './types'

/**
 * Stripe adapter — the primary gateway (cards, wallets, Bacs, payouts).
 *
 * Talks to the REST API directly (ADR-015 §3): no SDK, `fetch` + `node:crypto`.
 * Card data never reaches this code — we create PaymentIntents and hand the
 * client a `client_secret` for Stripe Elements, or a Checkout redirect. PCI
 * SAQ-A holds because the PAN is entered inside Stripe's iframe.
 *
 * API reference: https://docs.stripe.com/api
 */

const API = 'https://api.stripe.com/v1'
const API_VERSION = '2025-04-30.basil'
const log = createLogger('payments:stripe')

/** Stripe's PaymentIntent states → our five. */
function mapStatus(stripeStatus: string): IntentStatus {
  switch (stripeStatus) {
    case 'succeeded':
      return 'succeeded'
    case 'processing':
      return 'processing'
    case 'canceled':
      return 'cancelled'
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'requires_capture':
      return 'requires_action'
    default:
      return 'processing'
  }
}

export function createStripeProvider(config: { secretKey: string, webhookSecret: string }): PaymentProvider {
  const liveMode = config.secretKey.startsWith('sk_live_')

  function authHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.secretKey}`,
      'Stripe-Version': API_VERSION,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey
    }
    return headers
  }

  function toChargeResult(intent: any): ChargeResult {
    const charge = intent.latest_charge
    return {
      providerIntentId: intent.id,
      status: mapStatus(intent.status),
      clientSecret: intent.client_secret ?? undefined,
      redirectUrl: intent.next_action?.redirect_to_url?.url ?? undefined,
      failureCode: intent.last_payment_error?.code ?? undefined,
      failureMessage: intent.last_payment_error?.message ?? undefined,
      feeAmount: typeof charge === 'object' ? charge?.balance_transaction?.fee : undefined,
    }
  }

  return {
    name: 'stripe',
    capabilities: ['charge', 'mandate', 'recurring', 'refund', 'payout', 'bank_link'],
    liveMode,

    async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
      const offSession = Boolean(input.providerMethodId)

      const payload: Record<string, any> = {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        description: input.description,
        // Shows on the Stripe dashboard so support can match a customer
        // query to our PaymentIntent without a database lookup.
        metadata: { ...input.metadata, apex_reference: input.reference, apex_user_id: input.customer.userId },
        receipt_email: input.customer.email,
      }

      if (input.customer.providerCustomerId) {
        payload.customer = input.customer.providerCustomerId
      }

      if (offSession) {
        // Charging a saved instrument with no customer present: confirm
        // immediately and tell Stripe this is off-session so it applies the
        // right SCA exemption (and fails loudly rather than silently pending).
        payload.payment_method = input.providerMethodId
        payload.confirm = true
        payload.off_session = true
      }
      else {
        payload.automatic_payment_methods = { enabled: true }
        if (input.returnUrl) {
          payload.return_url = input.returnUrl
        }
      }

      const intent = await providerFetch({
        provider: 'stripe',
        method: 'POST',
        url: `${API}/payment_intents`,
        headers: authHeaders(input.idempotencyKey),
        body: formEncode(payload),
      })

      log.info('payment intent created', { reference: input.reference, intentId: intent.id, status: intent.status, amount: input.amount })
      return toChargeResult(intent)
    },

    async getCharge(providerIntentId: string): Promise<ChargeResult> {
      const intent = await providerFetch({
        provider: 'stripe',
        method: 'GET',
        url: `${API}/payment_intents/${encodeURIComponent(providerIntentId)}?expand[]=latest_charge.balance_transaction`,
        headers: authHeaders(),
      })
      return toChargeResult(intent)
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      const refund = await providerFetch({
        provider: 'stripe',
        method: 'POST',
        url: `${API}/refunds`,
        headers: authHeaders(input.idempotencyKey),
        body: formEncode({
          payment_intent: input.providerIntentId,
          amount: input.amount,
          reason: input.reason === 'fraudulent' || input.reason === 'duplicate' ? input.reason : 'requested_by_customer',
        }),
      })
      return {
        providerRefundId: refund.id,
        status: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : 'processing',
        amount: refund.amount,
        failureMessage: refund.failure_reason ?? undefined,
      }
    },

    async payout(input): Promise<{ providerPayoutId: string, status: 'pending' | 'paid' | 'failed' | 'cancelled', failureMessage?: string }> {
      // Paying a customer requires a destination Stripe can reach. Without a
      // Connect account we cannot push funds, and pretending otherwise would
      // be exactly the fabricated financial action the project forbids.
      if (!input.providerMethodId) {
        throw new PaymentProviderError(
          'Stripe payouts need a connected account or verified external account as the destination.',
          'stripe',
          'missing_destination',
          400,
        )
      }
      const transfer = await providerFetch({
        provider: 'stripe',
        method: 'POST',
        url: `${API}/transfers`,
        headers: authHeaders(input.idempotencyKey),
        body: formEncode({
          amount: input.amount,
          currency: input.currency.toLowerCase(),
          destination: input.providerMethodId,
          description: input.description,
          metadata: { apex_reference: input.reference, apex_user_id: input.customer.userId },
        }),
      })
      return { providerPayoutId: transfer.id, status: 'pending' }
    },

    async verifyWebhook(rawBody: string, headers): Promise<NormalisedEvent> {
      // Refuse rather than skip verification: an unverified webhook is an
      // unauthenticated write to financial state.
      if (!config.webhookSecret) {
        throw new WebhookSignatureError(
          'stripe',
          'No Stripe webhook secret configured — cannot verify this callback. Set NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET.',
        )
      }

      const header = headers['stripe-signature']
      if (!header) {
        throw new WebhookSignatureError('stripe', 'Missing Stripe-Signature header')
      }

      // Header format: t=<unix>,v1=<hex>[,v1=<hex>...]
      const parts = Object.fromEntries(
        header.split(',').map(kv => kv.split('=', 2) as [string, string]),
      )
      const timestamp = parts.t
      const signatures = header
        .split(',')
        .filter(kv => kv.startsWith('v1='))
        .map(kv => kv.slice(3))

      if (!timestamp || signatures.length === 0) {
        throw new WebhookSignatureError('stripe', 'Malformed Stripe-Signature header')
      }

      // Reject stale signatures — without this, a captured webhook can be
      // replayed indefinitely.
      const age = Math.abs(Date.now() / 1000 - Number(timestamp))
      if (!Number.isFinite(age) || age > 300) {
        throw new WebhookSignatureError('stripe', 'Webhook timestamp outside the 5-minute tolerance')
      }

      const expected = createHmac('sha256', config.webhookSecret)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex')

      const matches = signatures.some((candidate) => {
        const a = Buffer.from(candidate, 'hex')
        const b = Buffer.from(expected, 'hex')
        return a.length === b.length && timingSafeEqual(a, b)
      })
      if (!matches) {
        throw new WebhookSignatureError('stripe')
      }

      const event = JSON.parse(rawBody)
      return normaliseStripeEvent(event)
    },

    async getBalance(): Promise<ProviderBalance> {
      const balance = await providerFetch({
        provider: 'stripe',
        method: 'GET',
        url: `${API}/balance`,
        headers: authHeaders(),
      })
      const gbpAvailable = balance.available?.find((b: any) => b.currency === 'gbp')
      const gbpPending = balance.pending?.find((b: any) => b.currency === 'gbp')
      return {
        available: gbpAvailable?.amount ?? 0,
        pending: gbpPending?.amount ?? 0,
        currency: 'GBP',
      }
    },
  }
}

/** Stripe's event vocabulary → our `kind` union. */
function normaliseStripeEvent(event: any): NormalisedEvent {
  const object = event.data?.object ?? {}
  const base = {
    providerEventId: event.id,
    type: event.type,
    occurredAt: new Date((event.created ?? Date.now() / 1000) * 1000),
    amount: object.amount ?? object.amount_received,
    currency: (object.currency ?? 'gbp').toUpperCase(),
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      return { ...base, kind: 'charge.succeeded', providerIntentId: object.id, amount: object.amount_received ?? object.amount }
    case 'payment_intent.payment_failed':
      return {
        ...base,
        kind: 'charge.failed',
        providerIntentId: object.id,
        failureCode: object.last_payment_error?.code,
        failureMessage: object.last_payment_error?.message,
      }
    case 'payment_intent.processing':
      return { ...base, kind: 'charge.pending', providerIntentId: object.id }
    case 'charge.refunded':
    case 'refund.created':
    case 'refund.updated':
      return {
        ...base,
        kind: object.status === 'failed' ? 'refund.failed' : 'refund.succeeded',
        providerRefundId: object.id,
        providerIntentId: object.payment_intent,
      }
    case 'mandate.updated':
      return {
        ...base,
        kind: object.status === 'active' ? 'mandate.active' : 'mandate.cancelled',
        providerMethodId: object.payment_method,
      }
    case 'payout.paid':
      return { ...base, kind: 'payout.paid', providerPayoutId: object.id }
    case 'payout.failed':
      return { ...base, kind: 'payout.failed', providerPayoutId: object.id, failureMessage: object.failure_message }
    default:
      return { ...base, kind: 'unknown' }
  }
}
