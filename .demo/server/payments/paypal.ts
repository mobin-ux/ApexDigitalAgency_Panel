import { Buffer } from 'node:buffer'
import { createLogger } from '../utils/logger'
import { providerFetch } from './client'
import {
  type ChargeResult,
  type CreateChargeInput,
  type NormalisedEvent,
  type PaymentProvider,
  type RefundInput,
  type RefundResult,
  WebhookSignatureError,
} from './types'
import { toMajor } from '../utils/money'

/**
 * PayPal adapter — Orders v2, wallet top-ups only.
 *
 * Deliberately NOT used for installments: no usable UK direct-debit
 * equivalent and the worst unit economics of the four rails (ADR-015 §2).
 * It exists because a meaningful share of SMB clients will not pay any
 * other way.
 *
 * Note PayPal is the one provider here whose amounts are DECIMAL STRINGS,
 * not minor units — conversion happens at this boundary and nowhere else.
 *
 * API reference: https://developer.paypal.com/docs/api/orders/v2/
 */

const log = createLogger('payments:paypal')

export function createPayPalProvider(config: {
  clientId: string
  clientSecret: string
  webhookId: string
  environment: 'sandbox' | 'live'
}): PaymentProvider {
  const API = config.environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

  // OAuth tokens last ~9 hours; cache until shortly before expiry rather
  // than paying a round trip on every call.
  let cachedToken: { value: string, expiresAt: number } | null = null

  async function accessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.value
    }
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
    const response = await providerFetch({
      provider: 'paypal',
      method: 'POST',
      url: `${API}/v1/oauth2/token`,
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    cachedToken = {
      value: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
    }
    return cachedToken.value
  }

  async function headers(idempotencyKey?: string): Promise<Record<string, string>> {
    const base: Record<string, string> = {
      'Authorization': `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    }
    if (idempotencyKey) {
      base['PayPal-Request-Id'] = idempotencyKey
    }
    return base
  }

  function mapStatus(status: string): ChargeResult['status'] {
    switch (status) {
      case 'COMPLETED':
        return 'succeeded'
      case 'APPROVED':
      case 'CREATED':
      case 'PAYER_ACTION_REQUIRED':
        return 'requires_action'
      case 'VOIDED':
        return 'cancelled'
      default:
        return 'processing'
    }
  }

  return {
    name: 'paypal',
    capabilities: ['charge', 'refund'],
    liveMode: config.environment === 'live',

    async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
      const order = await providerFetch({
        provider: 'paypal',
        method: 'POST',
        url: `${API}/v2/checkout/orders`,
        headers: await headers(input.idempotencyKey),
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: input.reference,
            description: input.description.slice(0, 127),
            amount: {
              currency_code: input.currency.toUpperCase(),
              value: toMajor(input.amount, input.currency).toFixed(2),
            },
            custom_id: input.customer.userId,
          }],
          payment_source: {
            paypal: {
              experience_context: {
                return_url: input.returnUrl,
                cancel_url: input.returnUrl,
                user_action: 'PAY_NOW',
              },
            },
          },
        }),
      })

      const approve = order.links?.find((l: any) => l.rel === 'payer-action' || l.rel === 'approve')
      log.info('paypal order created', { reference: input.reference, orderId: order.id, status: order.status })

      return {
        providerIntentId: order.id,
        status: mapStatus(order.status),
        redirectUrl: approve?.href,
      }
    },

    async getCharge(providerIntentId: string): Promise<ChargeResult> {
      const order = await providerFetch({
        provider: 'paypal',
        method: 'GET',
        url: `${API}/v2/checkout/orders/${encodeURIComponent(providerIntentId)}`,
        headers: await headers(),
      })
      return { providerIntentId: order.id, status: mapStatus(order.status) }
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      // PayPal refunds target the CAPTURE, not the order, so resolve it first.
      const order = await providerFetch({
        provider: 'paypal',
        method: 'GET',
        url: `${API}/v2/checkout/orders/${encodeURIComponent(input.providerIntentId)}`,
        headers: await headers(),
      })
      const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id
      if (!captureId) {
        throw new WebhookSignatureError('paypal', 'No capture found for this order')
      }

      const refund = await providerFetch({
        provider: 'paypal',
        method: 'POST',
        url: `${API}/v2/payments/captures/${captureId}/refund`,
        headers: await headers(input.idempotencyKey),
        body: JSON.stringify(
          input.amount
            ? { amount: { currency_code: 'GBP', value: toMajor(input.amount).toFixed(2) }, note_to_payer: input.reason }
            : { note_to_payer: input.reason },
        ),
      })
      return {
        providerRefundId: refund.id,
        status: refund.status === 'COMPLETED' ? 'succeeded' : 'processing',
        amount: Math.round(Number.parseFloat(refund.amount?.value ?? '0') * 100),
      }
    },

    async verifyWebhook(rawBody: string, requestHeaders): Promise<NormalisedEvent> {
      // PayPal does not use a shared-secret HMAC: verification is an API call
      // that checks the cert-signed headers. That means a network round trip
      // per webhook, which is why we verify before doing any work and then
      // acknowledge immediately.
      const result = await providerFetch({
        provider: 'paypal',
        method: 'POST',
        url: `${API}/v1/notifications/verify-webhook-signature`,
        headers: await headers(),
        body: JSON.stringify({
          auth_algo: requestHeaders['paypal-auth-algo'],
          cert_url: requestHeaders['paypal-cert-url'],
          transmission_id: requestHeaders['paypal-transmission-id'],
          transmission_sig: requestHeaders['paypal-transmission-sig'],
          transmission_time: requestHeaders['paypal-transmission-time'],
          webhook_id: config.webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      })

      if (result.verification_status !== 'SUCCESS') {
        throw new WebhookSignatureError('paypal')
      }

      const event = JSON.parse(rawBody)
      const resource = event.resource ?? {}
      const base = {
        providerEventId: event.id,
        type: event.event_type,
        occurredAt: new Date(event.create_time ?? Date.now()),
        amount: resource.amount?.value ? Math.round(Number.parseFloat(resource.amount.value) * 100) : undefined,
        currency: resource.amount?.currency_code ?? 'GBP',
      }

      switch (event.event_type) {
        case 'CHECKOUT.ORDER.APPROVED':
          return { ...base, kind: 'charge.pending', providerIntentId: resource.id }
        case 'PAYMENT.CAPTURE.COMPLETED':
          return { ...base, kind: 'charge.succeeded', providerIntentId: resource.supplementary_data?.related_ids?.order_id ?? resource.id }
        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.DECLINED':
          return { ...base, kind: 'charge.failed', providerIntentId: resource.supplementary_data?.related_ids?.order_id ?? resource.id }
        case 'PAYMENT.CAPTURE.REFUNDED':
          return { ...base, kind: 'refund.succeeded', providerRefundId: resource.id }
        default:
          return { ...base, kind: 'unknown' }
      }
    },
  }
}
