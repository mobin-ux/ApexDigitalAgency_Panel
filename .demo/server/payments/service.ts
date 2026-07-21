import { randomBytes, randomUUID } from 'node:crypto'
import type { PaymentIntent } from '@prisma/client'
import { createLogger } from '../utils/logger'
import { assertValidMinor, toMajor } from '../utils/money'
import prisma from '../utils/prisma'
import { getProvider, getProviderByName } from './registry'
import {
  installmentChargeLines,
  postJournal,
  walletTopUpLines,
} from './ledger'
import type { Capability, CustomerRef, NormalisedEvent, ProviderName } from './types'

/**
 * Payment orchestration — the layer routes talk to.
 *
 * Responsibilities that must live in exactly one place:
 *  - persist a PaymentIntent BEFORE calling the provider, so a dropped
 *    response leaves a recoverable record rather than an orphaned charge;
 *  - own the idempotency key, generated once and replayed on retry;
 *  - apply webhook outcomes exactly once, whatever the delivery count;
 *  - keep the wallet balance, the customer Transaction feed and the
 *    double-entry ledger in agreement — inside one DB transaction.
 *
 * Routes never call an adapter directly.
 */

const log = createLogger('payments:service')

/** Human-quotable reference that appears on the provider dashboard too. */
function newReference(): string {
  return `APX-PI-${randomBytes(4).toString('hex').toUpperCase()}`
}

export type Purpose = 'wallet_topup' | 'order_deposit' | 'installment' | 'credit_repay'

export interface StartPaymentInput {
  userId: string
  email: string
  name?: string
  /** Integer minor units. */
  amount: number
  currency?: string
  purpose: Purpose
  description: string
  /** Which rail to use; defaults to the capability's configured provider. */
  capability?: Capability
  /** Charge a saved instrument off-session instead of an interactive flow. */
  paymentMethodId?: string
  returnUrl?: string
  installmentId?: string
  projectId?: string
  metadata?: Record<string, string>
}

export interface StartPaymentResult {
  intent: PaymentIntent
  /** Where to send the customer, when the provider needs them present. */
  redirectUrl?: string
  clientSecret?: string
  /** True when the money already moved (mock rail, or an instant success). */
  settled: boolean
}

/**
 * Begin a payment. Creates the local record first, then calls the provider —
 * that order is what makes a network failure recoverable: the intent exists
 * in `requires_action` and the reconciliation sweep can resolve it against
 * the provider's own state.
 */
export async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  assertValidMinor(input.amount, 'payment amount')

  const currency = input.currency ?? 'GBP'
  const capability: Capability = input.capability ?? (input.paymentMethodId ? 'recurring' : 'charge')
  const provider = await getProvider(capability)

  const reference = newReference()
  const idempotencyKey = `${reference}-${randomUUID()}`

  // Resolve the saved instrument (and check it belongs to this user) before
  // anything is created — an IDOR here would charge someone else's mandate.
  let providerMethodId: string | undefined
  if (input.paymentMethodId) {
    const method = await prisma.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, userId: input.userId, status: 'active' },
    })
    if (!method) {
      throw new Error('Payment method not found for this account')
    }
    providerMethodId = method.providerMethodId
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      reference,
      provider: provider.name,
      purpose: input.purpose,
      status: 'requires_action',
      amount: input.amount,
      currency,
      idempotencyKey,
      userId: input.userId,
      paymentMethodId: input.paymentMethodId,
      installmentId: input.installmentId,
      projectId: input.projectId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  const customer: CustomerRef = { userId: input.userId, email: input.email, name: input.name }

  try {
    const result = await provider.createCharge({
      amount: input.amount,
      currency,
      customer,
      idempotencyKey,
      reference,
      description: input.description,
      providerMethodId,
      returnUrl: input.returnUrl,
      metadata: input.metadata,
    })

    // `settleIntent` OWNS the transition to succeeded — it is the only place
    // that moves money, and it claims the row with a conditional update.
    // Writing 'succeeded' here would satisfy that guard preemptively and the
    // settlement would silently no-op, leaving a succeeded intent with no
    // wallet credit and no ledger entry.
    const updated = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerIntentId: result.providerIntentId,
        status: result.status === 'succeeded' ? 'processing' : result.status,
        feeAmount: result.feeAmount ?? 0,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
      },
    })

    // A provider that settles synchronously (mock, some off-session card
    // charges) still has to produce the same side effects as a webhook.
    let settled = false
    if (result.status === 'succeeded') {
      settled = await settleIntent(updated.id, { feeAmount: result.feeAmount ?? 0 })
    }

    return {
      intent: settled ? await prisma.paymentIntent.findUniqueOrThrow({ where: { id: updated.id } }) : updated,
      redirectUrl: result.redirectUrl,
      clientSecret: result.clientSecret,
      settled,
    }
  }
  catch (error: any) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: 'failed', failureCode: error?.code ?? 'provider_error', failureMessage: error?.message?.slice(0, 500) },
    })
    log.error('payment start failed', { reference, provider: provider.name, message: error?.message })
    throw error
  }
}

/**
 * Apply a successful payment exactly once.
 *
 * Guarded by a conditional update on `status`: concurrent webhook deliveries
 * race here constantly (Stripe retries for 72h and can deliver duplicates
 * within milliseconds), and only the update that actually flips the row from
 * a non-settled state is allowed to move money.
 */
export async function settleIntent(intentId: string, opts?: { feeAmount?: number }): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentIntent.updateMany({
      where: { id: intentId, status: { notIn: ['succeeded', 'cancelled'] } },
      data: { status: 'succeeded', settledAt: new Date(), feeAmount: opts?.feeAmount ?? undefined },
    })
    if (claimed.count === 0) {
      log.debug('intent already settled — ignoring duplicate', { intentId })
      return false
    }

    const intent = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intentId } })
    const major = toMajor(intent.amount, intent.currency)

    if (intent.purpose === 'wallet_topup') {
      await tx.user.update({
        where: { id: intent.userId },
        data: { walletBalance: { increment: major } },
      })
      await tx.transaction.create({
        data: {
          userId: intent.userId,
          amount: major,
          type: 'DEPOSIT',
          description: `Wallet top-up — ${intent.reference}`,
        },
      })
      await postJournal({
        tx,
        description: `Wallet top-up ${intent.reference}`,
        paymentIntentId: intent.id,
        currency: intent.currency,
        lines: walletTopUpLines({
          userId: intent.userId,
          amount: intent.amount,
          fee: opts?.feeAmount ?? intent.feeAmount ?? 0,
        }),
      })
    }
    else if (intent.purpose === 'installment') {
      // The wallet is not involved: this collected straight from the
      // customer's bank via direct debit, so revenue is recognised directly.
      await tx.transaction.create({
        data: {
          userId: intent.userId,
          amount: -major,
          type: 'PAYMENT',
          installmentId: intent.installmentId,
          description: `Installment collected — ${intent.reference}`,
        },
      })
      await postJournal({
        tx,
        description: `Installment collection ${intent.reference}`,
        paymentIntentId: intent.id,
        currency: intent.currency,
        lines: [
          { account: 'PROVIDER_CLEARING', direction: 'DEBIT', amount: intent.amount, userId: intent.userId },
          { account: 'REVENUE', direction: 'CREDIT', amount: intent.amount },
        ],
      })
    }

    await tx.notification.create({
      data: {
        userId: intent.userId,
        title: 'Payment received',
        message: `Your payment of £${major.toFixed(2)} (${intent.reference}) was successful.`,
        type: 'SUCCESS',
        link: '/dashboards/wallet',
      },
    })

    log.info('intent settled', { intentId, reference: intent.reference, purpose: intent.purpose, amount: intent.amount })
    return true
  })
}

/** Mark an intent failed, once. Safe to call from duplicate webhooks. */
export async function failIntent(intentId: string, failure: { code?: string, message?: string }): Promise<boolean> {
  const claimed = await prisma.paymentIntent.updateMany({
    where: { id: intentId, status: { notIn: ['succeeded', 'failed', 'cancelled'] } },
    data: { status: 'failed', failureCode: failure.code, failureMessage: failure.message?.slice(0, 500) },
  })
  if (claimed.count === 0) {
    return false
  }

  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } })
  if (intent) {
    await prisma.notification.create({
      data: {
        userId: intent.userId,
        title: 'Payment failed',
        message: failure.message
          ? `Your payment ${intent.reference} could not be completed: ${failure.message}`
          : `Your payment ${intent.reference} could not be completed.`,
        type: 'WARNING',
        link: '/dashboards/wallet',
      },
    })
  }
  log.warn('intent failed', { intentId, ...failure })
  return true
}

/**
 * Translate a verified webhook into state changes. Pure dispatch — every
 * branch is idempotent, so replaying the stored payload is always safe.
 */
export async function applyWebhookEvent(provider: ProviderName, event: NormalisedEvent): Promise<void> {
  switch (event.kind) {
    case 'charge.succeeded': {
      const intent = await findIntent(provider, event.providerIntentId)
      if (intent) {
        await settleIntent(intent.id, { feeAmount: event.feeAmount })
      }
      break
    }
    case 'charge.failed': {
      const intent = await findIntent(provider, event.providerIntentId)
      if (intent) {
        await failIntent(intent.id, { code: event.failureCode, message: event.failureMessage })
      }
      break
    }
    case 'charge.pending': {
      const intent = await findIntent(provider, event.providerIntentId)
      if (intent) {
        await prisma.paymentIntent.updateMany({
          where: { id: intent.id, status: 'requires_action' },
          data: { status: 'processing' },
        })
      }
      break
    }
    case 'refund.succeeded': {
      if (event.providerRefundId) {
        await prisma.refund.updateMany({
          where: { provider, providerRefundId: event.providerRefundId },
          data: { status: 'succeeded' },
        })
      }
      break
    }
    case 'refund.failed': {
      if (event.providerRefundId) {
        await prisma.refund.updateMany({
          where: { provider, providerRefundId: event.providerRefundId },
          data: { status: 'failed' },
        })
      }
      break
    }
    case 'mandate.active': {
      const method = await findMethod(provider, event)
      if (method) {
        await prisma.paymentMethod.update({
          where: { id: method.id },
          data: {
            mandateStatus: 'active',
            // Adopt the real mandate id: setup stored the billing-request id,
            // and every future collection must reference the mandate.
            providerMethodId: event.providerMethodId ?? method.providerMethodId,
          },
        })
        // First usable instrument on the account becomes the default.
        const hasDefault = await prisma.paymentMethod.count({
          where: { userId: method.userId, status: 'active', isDefault: true },
        })
        if (hasDefault === 0) {
          await prisma.paymentMethod.update({ where: { id: method.id }, data: { isDefault: true } })
        }
        await prisma.notification.create({
          data: {
            userId: method.userId,
            title: 'Direct Debit ready',
            message: 'Your Direct Debit mandate is active. Instalments will be collected automatically.',
            type: 'SUCCESS',
            link: '/dashboards/wallet',
          },
        })
      }
      break
    }
    case 'mandate.cancelled':
    case 'mandate.failed': {
      const method = await findMethod(provider, event)
      if (method) {
        await prisma.paymentMethod.update({
          where: { id: method.id },
          data: {
            mandateStatus: event.kind === 'mandate.failed' ? 'failed' : 'cancelled',
            status: 'removed',
            isDefault: false,
          },
        })
        await prisma.notification.create({
          data: {
            userId: method.userId,
            title: 'Direct Debit ended',
            message: event.kind === 'mandate.failed'
              ? 'Your Direct Debit mandate could not be set up. Please add another payment method.'
              : 'Your Direct Debit mandate was cancelled. Add another method to keep instalments on track.',
            type: 'WARNING',
            link: '/dashboards/wallet',
          },
        })
      }
      break
    }
    case 'payout.paid':
    case 'payout.failed': {
      if (event.providerPayoutId) {
        await prisma.payout.updateMany({
          where: { provider, providerPayoutId: event.providerPayoutId },
          data: {
            status: event.kind === 'payout.paid' ? 'paid' : 'failed',
            failureMessage: event.failureMessage,
          },
        })
      }
      break
    }
    default:
      log.debug('unhandled webhook kind', { provider, type: event.type })
  }
}

async function findIntent(provider: ProviderName, providerIntentId?: string) {
  if (!providerIntentId) {
    return null
  }
  return prisma.paymentIntent.findFirst({ where: { provider, providerIntentId } })
}

/**
 * Locate the local PaymentMethod for a mandate event, by the mandate id if
 * we already adopted it, otherwise by the setup-time id we stored.
 */
async function findMethod(provider: ProviderName, event: NormalisedEvent) {
  const candidates = [event.providerMethodId, event.setupReferenceId].filter(Boolean) as string[]
  if (candidates.length === 0) {
    return null
  }
  return prisma.paymentMethod.findFirst({
    where: { provider, providerMethodId: { in: candidates } },
  })
}

/**
 * Resolve intents stuck in a non-final state by asking the provider what
 * actually happened. Webhooks get lost — this is the backstop that keeps a
 * customer from being charged with nothing to show for it.
 */
export async function sweepStaleIntents(opts?: { olderThanMinutes?: number, limit?: number }): Promise<number> {
  const cutoff = new Date(Date.now() - (opts?.olderThanMinutes ?? 30) * 60_000)
  const stale = await prisma.paymentIntent.findMany({
    where: {
      status: { in: ['requires_action', 'processing'] },
      createdAt: { lt: cutoff },
      providerIntentId: { not: null },
    },
    take: opts?.limit ?? 50,
  })

  let resolved = 0
  for (const intent of stale) {
    const provider = getProviderByName(intent.provider as ProviderName)
    if (!provider) {
      continue
    }
    try {
      const remote = await provider.getCharge(intent.providerIntentId!)
      if (remote.status === 'succeeded') {
        await settleIntent(intent.id, { feeAmount: remote.feeAmount })
        resolved++
      }
      else if (remote.status === 'failed' || remote.status === 'cancelled') {
        await failIntent(intent.id, { code: remote.failureCode, message: remote.failureMessage })
        resolved++
      }
    }
    catch (error: any) {
      log.warn('stale sweep could not resolve intent', { intentId: intent.id, message: error?.message })
    }
  }

  if (resolved > 0) {
    log.info('stale intent sweep resolved intents', { resolved, scanned: stale.length })
  }
  return resolved
}

export { installmentChargeLines }
