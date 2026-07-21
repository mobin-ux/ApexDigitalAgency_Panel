/**
 * The provider-agnostic payment contract (ADR-015 §4).
 *
 * Every call site in the application — wallet top-ups, installment
 * collection, refunds, withdrawals — depends on THIS file and nothing
 * provider-specific. Adding a rail means writing one adapter; switching
 * rails is a Setting change, not a code change.
 *
 * Amounts are always integer MINOR UNITS (pence). See utils/money.ts.
 */

export type ProviderName = 'stripe' | 'gocardless' | 'paypal' | 'truelayer' | 'mock'

/**
 * What a provider can actually do. The registry resolves a provider *per
 * capability*, so cards can route to Stripe while direct debit routes to
 * GoCardless in the same deployment.
 */
export type Capability =
  | 'charge' // one-off pull from a card/wallet
  | 'mandate' // set up a reusable direct-debit authority
  | 'recurring' // collect against an existing mandate
  | 'refund'
  | 'payout' // push money out to a customer
  | 'bank_link' // read-only bank account verification/linking

export type IntentStatus = 'requires_action' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
export type MandateStatus = 'pending_submission' | 'submitted' | 'active' | 'cancelled' | 'failed'
export type PaymentKind = 'card' | 'bacs_debit' | 'paypal' | 'open_banking'

export interface Money {
  /** Integer minor units. */
  amount: number
  currency: string
}

export interface CustomerRef {
  userId: string
  email: string
  name?: string
  /** Provider-side customer id when we already created one. */
  providerCustomerId?: string
}

export interface CreateChargeInput extends Money {
  customer: CustomerRef
  /** Replayed verbatim on retry — the provider must dedupe on this. */
  idempotencyKey: string
  /** Our own reference, surfaced on the provider dashboard for support. */
  reference: string
  description: string
  /** Saved instrument to charge off-session; omit for an interactive checkout. */
  providerMethodId?: string
  /** Where the hosted flow returns the customer. */
  returnUrl?: string
  metadata?: Record<string, string>
}

export interface ChargeResult {
  providerIntentId: string
  status: IntentStatus
  /**
   * Present when the customer must complete something in a provider-hosted
   * surface (Checkout redirect, 3-D Secure, bank approval). Never a secret
   * we can act on — just where to send them.
   */
  redirectUrl?: string
  /** Publishable-key-scoped handle for client-side confirmation (Stripe Elements). */
  clientSecret?: string
  failureCode?: string
  failureMessage?: string
  /** Provider fee, when the provider reports it synchronously. */
  feeAmount?: number
}

export interface CreateMandateInput {
  customer: CustomerRef
  reference: string
  idempotencyKey: string
  returnUrl: string
  description: string
}

export interface MandateResult {
  providerMethodId: string
  status: MandateStatus
  /** Hosted mandate-authorisation page — the customer must visit it. */
  redirectUrl?: string
  kind: PaymentKind
  brand?: string
  last4?: string
  accountHolder?: string
}

export interface RefundInput {
  providerIntentId: string
  /** Integer minor units; omit for a full refund. */
  amount?: number
  reason?: string
  idempotencyKey: string
}

export interface RefundResult {
  providerRefundId: string
  status: 'processing' | 'succeeded' | 'failed'
  amount: number
  failureMessage?: string
}

export interface PayoutInput extends Money {
  customer: CustomerRef
  /** Destination instrument (verified bank account / mandate). */
  providerMethodId?: string
  reference: string
  idempotencyKey: string
  description: string
}

export interface PayoutResult {
  providerPayoutId: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  failureMessage?: string
}

/** Normalised webhook — adapters translate their provider's vocabulary into this. */
export interface NormalisedEvent {
  providerEventId: string
  type: string
  /** What our handlers switch on, once the provider dialect is stripped away. */
  kind:
    | 'charge.succeeded'
    | 'charge.failed'
    | 'charge.pending'
    | 'refund.succeeded'
    | 'refund.failed'
    | 'mandate.active'
    | 'mandate.cancelled'
    | 'mandate.failed'
    | 'payout.paid'
    | 'payout.failed'
    | 'unknown'
  providerIntentId?: string
  providerRefundId?: string
  providerMethodId?: string
  providerPayoutId?: string
  /**
   * The id we stored when the flow STARTED, when the provider issues a
   * different one on completion. GoCardless does exactly this: setup begins
   * against a billing-request id and the activated mandate has its own id,
   * so without this the confirmation webhook matches nothing.
   */
  setupReferenceId?: string
  amount?: number
  currency?: string
  feeAmount?: number
  failureCode?: string
  failureMessage?: string
  occurredAt: Date
}

export interface ProviderBalance {
  /** Integer minor units currently held at the provider on our behalf. */
  available: number
  pending: number
  currency: string
}

/**
 * A payment rail. Optional methods are genuinely optional — the registry
 * checks `capabilities` before routing, so an adapter only implements what
 * its provider actually does.
 */
export interface PaymentProvider {
  readonly name: ProviderName
  readonly capabilities: readonly Capability[]
  /** False for sandbox/test credentials. Guarded by the registry (ADR-015 §9). */
  readonly liveMode: boolean

  createCharge: (input: CreateChargeInput) => Promise<ChargeResult>
  /** Re-read authoritative state; used by reconciliation and stale-intent sweeps. */
  getCharge: (providerIntentId: string) => Promise<ChargeResult>

  createMandate?: (input: CreateMandateInput) => Promise<MandateResult>
  getMandate?: (providerMethodId: string) => Promise<MandateResult>
  cancelMandate?: (providerMethodId: string) => Promise<void>

  refund?: (input: RefundInput) => Promise<RefundResult>
  payout?: (input: PayoutInput) => Promise<PayoutResult>

  /**
   * Verify the raw request body against the provider's signature scheme and
   * return a normalised event. MUST throw on an invalid signature — the
   * signature is the only authentication a webhook route has (ADR-015 §7).
   */
  verifyWebhook: (rawBody: string, headers: Record<string, string | undefined>) => Promise<NormalisedEvent>

  /** Provider-side balance, for reconciliation against PROVIDER_CLEARING. */
  getBalance?: () => Promise<ProviderBalance>
}

/** Thrown by adapters for provider-reported failures; carries a safe message. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly code?: string,
    readonly statusCode = 502,
    readonly retryable = false,
  ) {
    super(message)
    this.name = 'PaymentProviderError'
  }
}

export class WebhookSignatureError extends Error {
  constructor(readonly provider: ProviderName, message = 'Invalid webhook signature') {
    super(message)
    this.name = 'WebhookSignatureError'
  }
}
