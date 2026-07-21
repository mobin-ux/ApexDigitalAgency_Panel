import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createLogger } from '../utils/logger'
import { providerFetch } from './client'
import {
  type ChargeResult,
  type CreateChargeInput,
  type CreateMandateInput,
  type MandateResult,
  type MandateStatus,
  type NormalisedEvent,
  type PaymentProvider,
  PaymentProviderError,
  type RefundInput,
  type RefundResult,
  WebhookSignatureError,
} from './types'

/**
 * GoCardless adapter — Bacs Direct Debit, the installment collection rail.
 *
 * Chosen because its 1% + 20p is CAPPED AT £4: on a 24-month plan for a £10k
 * contract that is ~£96 of fees against ~£440 on cards, and Bacs mandates
 * survive card expiry/reissue — the dominant involuntary-churn cause on
 * multi-year plans (ADR-015 §2).
 *
 * Mandate setup uses Billing Request Flows: a GoCardless-hosted page collects
 * the bank details, so account numbers and sort codes never touch our servers.
 *
 * API reference: https://developer.gocardless.com/api-reference
 */

const API_VERSION = '2015-07-06'
const log = createLogger('payments:gocardless')

/** Bacs takes days to clear, so "submitted" is a real, long-lived state. */
function mapPaymentStatus(status: string): ChargeResult['status'] {
  switch (status) {
    case 'confirmed':
    case 'paid_out':
      return 'succeeded'
    case 'pending_submission':
    case 'submitted':
      return 'processing'
    case 'cancelled':
      return 'cancelled'
    case 'failed':
    case 'charged_back':
      return 'failed'
    default:
      return 'processing'
  }
}

function mapMandateStatus(status: string): MandateStatus {
  switch (status) {
    case 'active':
      return 'active'
    case 'pending_submission':
    case 'pending_customer_approval':
      return 'pending_submission'
    case 'submitted':
      return 'submitted'
    case 'cancelled':
    case 'expired':
      return 'cancelled'
    case 'failed':
      return 'failed'
    default:
      return 'pending_submission'
  }
}

export function createGoCardlessProvider(config: {
  accessToken: string
  webhookSecret: string
  environment: 'sandbox' | 'live'
}): PaymentProvider {
  const API = config.environment === 'live'
    ? 'https://api.gocardless.com'
    : 'https://api-sandbox.gocardless.com'

  function headers(idempotencyKey?: string): Record<string, string> {
    const base: Record<string, string> = {
      'Authorization': `Bearer ${config.accessToken}`,
      'GoCardless-Version': API_VERSION,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (idempotencyKey) {
      base['Idempotency-Key'] = idempotencyKey
    }
    return base
  }

  return {
    name: 'gocardless',
    capabilities: ['mandate', 'recurring', 'refund', 'payout'],
    liveMode: config.environment === 'live',

    async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
      // Direct debit is a pull against an existing authority — there is no
      // interactive path. Callers must set up a mandate first.
      if (!input.providerMethodId) {
        throw new PaymentProviderError(
          'Direct debit needs an active mandate. Set one up before collecting.',
          'gocardless',
          'mandate_required',
          400,
        )
      }

      const response = await providerFetch({
        provider: 'gocardless',
        method: 'POST',
        url: `${API}/payments`,
        headers: headers(input.idempotencyKey),
        body: JSON.stringify({
          payments: {
            amount: input.amount,
            currency: input.currency.toUpperCase(),
            description: input.description,
            // Appears on the payer's bank statement (18 chars, Bacs limit).
            reference: input.reference.slice(0, 18),
            links: { mandate: input.providerMethodId },
            metadata: {
              apex_reference: input.reference,
              apex_user_id: input.customer.userId,
            },
          },
        }),
      })

      const payment = response.payments
      log.info('direct debit collection created', { reference: input.reference, paymentId: payment.id, status: payment.status })

      return {
        providerIntentId: payment.id,
        status: mapPaymentStatus(payment.status),
      }
    },

    async getCharge(providerIntentId: string): Promise<ChargeResult> {
      const response = await providerFetch({
        provider: 'gocardless',
        method: 'GET',
        url: `${API}/payments/${encodeURIComponent(providerIntentId)}`,
        headers: headers(),
      })
      const payment = response.payments
      return {
        providerIntentId: payment.id,
        status: mapPaymentStatus(payment.status),
        failureMessage: payment.status === 'failed' ? 'Direct debit collection failed' : undefined,
      }
    },

    async createMandate(input: CreateMandateInput): Promise<MandateResult> {
      // Billing Request + Flow: GoCardless hosts the bank-details form and
      // the Direct Debit Guarantee wording, keeping us out of PCI/bank-data
      // scope entirely.
      const request = await providerFetch({
        provider: 'gocardless',
        method: 'POST',
        url: `${API}/billing_requests`,
        headers: headers(input.idempotencyKey),
        body: JSON.stringify({
          billing_requests: {
            mandate_request: { scheme: 'bacs', currency: 'GBP' },
            metadata: { apex_reference: input.reference, apex_user_id: input.customer.userId },
          },
        }),
      })

      const flow = await providerFetch({
        provider: 'gocardless',
        method: 'POST',
        url: `${API}/billing_request_flows`,
        headers: headers(`${input.idempotencyKey}-flow`),
        body: JSON.stringify({
          billing_request_flows: {
            redirect_uri: input.returnUrl,
            exit_uri: input.returnUrl,
            prefilled_customer: {
              email: input.customer.email,
              given_name: input.customer.name?.split(' ')[0],
              family_name: input.customer.name?.split(' ').slice(1).join(' ') || undefined,
            },
            links: { billing_request: request.billing_requests.id },
          },
        }),
      })

      log.info('mandate flow created', { reference: input.reference, billingRequestId: request.billing_requests.id })

      return {
        // Until the customer completes the flow this is the billing-request
        // id; the mandate id arrives on the `mandates.active` webhook.
        providerMethodId: request.billing_requests.id,
        status: 'pending_submission',
        redirectUrl: flow.billing_request_flows.authorisation_url,
        kind: 'bacs_debit',
        brand: 'Bacs Direct Debit',
      }
    },

    async getMandate(providerMethodId: string): Promise<MandateResult> {
      const response = await providerFetch({
        provider: 'gocardless',
        method: 'GET',
        url: `${API}/mandates/${encodeURIComponent(providerMethodId)}`,
        headers: headers(),
      })
      const mandate = response.mandates
      return {
        providerMethodId: mandate.id,
        status: mapMandateStatus(mandate.status),
        kind: 'bacs_debit',
        brand: 'Bacs Direct Debit',
        last4: mandate.links?.customer_bank_account?.slice(-4),
      }
    },

    async cancelMandate(providerMethodId: string): Promise<void> {
      await providerFetch({
        provider: 'gocardless',
        method: 'POST',
        url: `${API}/mandates/${encodeURIComponent(providerMethodId)}/actions/cancel`,
        headers: headers(),
        body: JSON.stringify({ data: {} }),
      })
      log.info('mandate cancelled', { providerMethodId })
    },

    async refund(input: RefundInput): Promise<RefundResult> {
      const response = await providerFetch({
        provider: 'gocardless',
        method: 'POST',
        url: `${API}/refunds`,
        headers: headers(input.idempotencyKey),
        body: JSON.stringify({
          refunds: {
            amount: input.amount,
            links: { payment: input.providerIntentId },
            metadata: { reason: input.reason ?? 'requested_by_customer' },
          },
        }),
      })
      return {
        providerRefundId: response.refunds.id,
        status: 'processing', // Bacs refunds confirm asynchronously.
        amount: response.refunds.amount,
      }
    },

    async verifyWebhook(rawBody: string, requestHeaders): Promise<NormalisedEvent> {
      const signature = requestHeaders['webhook-signature']
      if (!signature) {
        throw new WebhookSignatureError('gocardless', 'Missing Webhook-Signature header')
      }

      const expected = createHmac('sha256', config.webhookSecret).update(rawBody, 'utf8').digest('hex')
      const a = Buffer.from(signature, 'hex')
      const b = Buffer.from(expected, 'hex')
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new WebhookSignatureError('gocardless')
      }

      // GoCardless batches: one request carries many events. The route
      // splits them; here we normalise the first and let the caller iterate.
      const parsed = JSON.parse(rawBody)
      const event = Array.isArray(parsed.events) ? parsed.events[0] : parsed
      return normaliseGoCardlessEvent(event)
    },
  }
}

/**
 * A GoCardless webhook body holds an array of events. The route needs all of
 * them, so this is exported separately from the single-event path above.
 */
export function normaliseGoCardlessBatch(rawBody: string): NormalisedEvent[] {
  const parsed = JSON.parse(rawBody)
  const events = Array.isArray(parsed.events) ? parsed.events : [parsed]
  return events.map(normaliseGoCardlessEvent)
}

function normaliseGoCardlessEvent(event: any): NormalisedEvent {
  const base = {
    providerEventId: event.id,
    type: `${event.resource_type}.${event.action}`,
    occurredAt: new Date(event.created_at ?? Date.now()),
  }
  const links = event.links ?? {}

  if (event.resource_type === 'payments') {
    switch (event.action) {
      case 'confirmed':
      case 'paid_out':
        return { ...base, kind: 'charge.succeeded', providerIntentId: links.payment }
      case 'failed':
      case 'charged_back':
        return {
          ...base,
          kind: 'charge.failed',
          providerIntentId: links.payment,
          failureCode: event.details?.cause,
          failureMessage: event.details?.description,
        }
      case 'submitted':
        return { ...base, kind: 'charge.pending', providerIntentId: links.payment }
    }
  }

  if (event.resource_type === 'mandates') {
    // `setupReferenceId` carries the billing-request id we stored when the
    // flow began — the mandate id below is newly minted at activation and
    // would otherwise match no local row.
    const ids = {
      providerMethodId: links.mandate,
      setupReferenceId: links.billing_request,
    }
    switch (event.action) {
      case 'active':
        return { ...base, kind: 'mandate.active', ...ids }
      case 'cancelled':
      case 'expired':
        return { ...base, kind: 'mandate.cancelled', ...ids }
      case 'failed':
        return { ...base, kind: 'mandate.failed', ...ids, failureMessage: event.details?.description }
    }
  }

  if (event.resource_type === 'refunds' && event.action === 'paid') {
    return { ...base, kind: 'refund.succeeded', providerRefundId: links.refund }
  }

  if (event.resource_type === 'payouts' && event.action === 'paid') {
    return { ...base, kind: 'payout.paid', providerPayoutId: links.payout }
  }

  return { ...base, kind: 'unknown' }
}
