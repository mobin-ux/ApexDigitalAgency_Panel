import { Buffer } from 'node:buffer'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createLogger } from '../utils/logger'
import {
  type ChargeResult,
  type CreateChargeInput,
  type CreateMandateInput,
  type MandateResult,
  type NormalisedEvent,
  type PaymentProvider,
  type PayoutInput,
  type PayoutResult,
  type ProviderBalance,
  type RefundInput,
  type RefundResult,
  WebhookSignatureError,
} from './types'

/**
 * Mock provider — the default when no real credentials are configured.
 *
 * This is the safety property that matters: a missing or misconfigured key
 * can never silently fall through to charging real money. It also keeps
 * local development and CI fully functional with no accounts, and gives the
 * test suite a deterministic rail.
 *
 * Behaviour is deterministic, driven by the amount, so failure paths are
 * testable without provider sandboxes:
 *   - amount ending in 01 → declined
 *   - amount ending in 02 → requires_action (simulated 3-D Secure)
 *   - amount ending in 03 → stays processing (simulated Bacs clearing)
 *   - anything else       → succeeds immediately
 */

const log = createLogger('payments:mock')

/** Signs mock webhooks so the ingestion route can be exercised end to end. */
export const MOCK_WEBHOOK_SECRET = 'mock_whsec_apex_local_development'

function outcomeFor(amount: number): ChargeResult['status'] {
  const cents = amount % 100
  if (cents === 1) {
    return 'failed'
  }
  if (cents === 2) {
    return 'requires_action'
  }
  if (cents === 3) {
    return 'processing'
  }
  return 'succeeded'
}

export function createMockProvider(): PaymentProvider {
  return {
    name: 'mock',
    capabilities: ['charge', 'mandate', 'recurring', 'refund', 'payout', 'bank_link'],
    liveMode: false,

    async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
      const status = outcomeFor(input.amount)
      const id = `mock_pi_${randomUUID().replace(/-/g, '').slice(0, 20)}`
      log.info('mock charge', { reference: input.reference, amount: input.amount, status, id })

      return {
        providerIntentId: id,
        status,
        clientSecret: status === 'requires_action' ? `${id}_secret_mock` : undefined,
        redirectUrl: status === 'requires_action' ? `/dashboards/wallet?mock_intent=${id}` : undefined,
        failureCode: status === 'failed' ? 'card_declined' : undefined,
        failureMessage: status === 'failed' ? 'Your card was declined (simulated).' : undefined,
        feeAmount: status === 'succeeded' ? Math.round(input.amount * 0.014) + 20 : undefined,
      }
    },

    async getCharge(providerIntentId: string): Promise<ChargeResult> {
      return { providerIntentId, status: 'succeeded' }
    },

    async createMandate(input: CreateMandateInput): Promise<MandateResult> {
      const id = `mock_md_${randomUUID().replace(/-/g, '').slice(0, 16)}`
      return {
        providerMethodId: id,
        status: 'pending_submission',
        redirectUrl: `/dashboards/wallet?mock_mandate=${id}`,
        kind: 'bacs_debit',
        brand: 'Mock Bank',
        last4: '4321',
        accountHolder: input.customer.name,
      }
    },

    async getMandate(providerMethodId: string): Promise<MandateResult> {
      return { providerMethodId, status: 'active', kind: 'bacs_debit', brand: 'Mock Bank', last4: '4321' }
    },

    async cancelMandate(): Promise<void> {},

    async refund(input: RefundInput): Promise<RefundResult> {
      return {
        providerRefundId: `mock_re_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        status: 'succeeded',
        amount: input.amount ?? 0,
      }
    },

    async payout(input: PayoutInput): Promise<PayoutResult> {
      return {
        providerPayoutId: `mock_po_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        status: input.amount % 100 === 1 ? 'failed' : 'pending',
        failureMessage: input.amount % 100 === 1 ? 'Destination account rejected (simulated).' : undefined,
      }
    },

    async verifyWebhook(rawBody: string, headers): Promise<NormalisedEvent> {
      // Same shape as the real adapters so the ingestion route is exercised
      // honestly rather than short-circuited in development.
      const signature = headers['x-mock-signature']
      if (!signature) {
        throw new WebhookSignatureError('mock', 'Missing X-Mock-Signature header')
      }
      const expected = createHmac('sha256', MOCK_WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex')
      const a = Buffer.from(signature, 'hex')
      const b = Buffer.from(expected, 'hex')
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new WebhookSignatureError('mock')
      }

      const event = JSON.parse(rawBody)
      return {
        providerEventId: event.id ?? randomUUID(),
        type: event.type ?? 'mock.event',
        kind: event.kind ?? 'unknown',
        providerIntentId: event.providerIntentId,
        providerRefundId: event.providerRefundId,
        providerMethodId: event.providerMethodId,
        // Mirrors GoCardless: a mandate activates under a new id, and this
        // carries the setup-time id so the local row still resolves.
        setupReferenceId: event.setupReferenceId,
        providerPayoutId: event.providerPayoutId,
        amount: event.amount,
        currency: event.currency ?? 'GBP',
        occurredAt: new Date(event.occurredAt ?? Date.now()),
      }
    },

    async getBalance(): Promise<ProviderBalance> {
      return { available: 0, pending: 0, currency: 'GBP' }
    },
  }
}
