import type { ProviderName } from '../../../payments/types'
import { defineEventHandler } from 'h3'
import { trialBalance } from '../../../payments/ledger'
import { availableProviders, getProviderByName } from '../../../payments/registry'
import { createLogger } from '../../../utils/logger'
import { toMajor } from '../../../utils/money'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/payments/health — operational status of the payment rails.
 *
 * This is the page an operator opens at 3am. It answers, in one request:
 * which providers are configured and in which mode, does the ledger
 * balance, is anything stuck, and are webhooks being processed.
 *
 * Provider balance calls are best-effort and time-boxed by the shared
 * transport — a provider outage must not make the health check itself fail.
 */

const log = createLogger('payments:health')

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'money.view')

  const providers = availableProviders()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [balance, intentCounts, stuckIntents, webhookCounts, failedWebhooks, refundsPending] = await Promise.all([
    trialBalance(),
    prisma.paymentIntent.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
    prisma.paymentIntent.count({
      where: {
        status: { in: ['requires_action', 'processing'] },
        createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    }),
    prisma.webhookEvent.groupBy({ by: ['status'], _count: { _all: true }, where: { receivedAt: { gte: since } } }),
    prisma.webhookEvent.count({ where: { status: 'failed' } }),
    prisma.refund.count({ where: { status: 'processing' } }),
  ])

  // Ask each live-capable provider for its balance so the operator can see
  // clearing drift immediately. Failures are reported, not thrown.
  const providerBalances = await Promise.all(
    providers.map(async (p) => {
      const adapter = getProviderByName(p.name as ProviderName)
      if (!adapter?.getBalance) {
        return { provider: p.name, supported: false as const }
      }
      try {
        const remote = await adapter.getBalance()
        return { provider: p.name, supported: true as const, ...remote }
      }
      catch (error: any) {
        log.warn('provider balance unavailable', { provider: p.name, message: error?.message })
        return { provider: p.name, supported: true as const, error: error?.message ?? 'unavailable' }
      }
    }),
  )

  const clearing = balance.accounts.find(a => a.account === 'PROVIDER_CLEARING')?.balance ?? 0

  // Anything here means a human needs to look.
  const warnings: string[] = []
  if (!balance.balanced) {
    warnings.push('Ledger does not balance — debits and credits diverge.')
  }
  if (stuckIntents > 0) {
    warnings.push(`${stuckIntents} payment intent(s) unresolved for over an hour — run the stale sweep.`)
  }
  if (failedWebhooks > 0) {
    warnings.push(`${failedWebhooks} webhook event(s) failed processing and need replay.`)
  }
  if (providers.every(p => p.name === 'mock')) {
    warnings.push('No real payment provider is configured — all rails are running on the mock adapter.')
  }

  return {
    status: warnings.length === 0 ? 'healthy' : 'attention',
    warnings,
    providers: providers.map(p => ({
      name: p.name,
      capabilities: p.capabilities,
      mode: p.liveMode ? 'live' : 'sandbox',
    })),
    providerBalances,
    ledger: {
      balanced: balance.balanced,
      accounts: balance.accounts.map(a => ({
        account: a.account,
        debits: toMajor(a.debits),
        credits: toMajor(a.credits),
        balance: toMajor(a.balance),
      })),
      clearingBalance: toMajor(clearing),
    },
    intents: intentCounts.map(row => ({
      status: row.status,
      count: row._count._all,
      total: toMajor(row._sum.amount ?? 0),
    })),
    stuckIntents,
    refundsPending,
    webhooks: {
      last24h: webhookCounts.map(row => ({ status: row.status, count: row._count._all })),
      failedTotal: failedWebhooks,
    },
  }
})
