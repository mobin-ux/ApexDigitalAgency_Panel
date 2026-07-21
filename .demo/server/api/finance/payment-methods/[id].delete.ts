import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getProviderByName } from '../../../payments/registry'
import type { ProviderName } from '../../../payments/types'
import { requireAuth } from '../../../utils/auth'
import { createLogger } from '../../../utils/logger'
import prisma from '../../../utils/prisma'

/**
 * DELETE /api/finance/payment-methods/:id — remove a saved instrument.
 *
 * Refuses to strand an active instalment plan: if this is the only usable
 * method and a plan is set to auto-collect, removing it would silently turn
 * off collection and put the customer into arrears. Better to block with a
 * clear message than to be quietly helpful.
 *
 * Soft-deleted (`status: 'removed'`) rather than hard-deleted, because
 * historical PaymentIntents reference it and a payment record whose
 * instrument vanished is unauditable.
 */

const log = createLogger('payment-methods')

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Payment method id is required' })
  }

  const method = await prisma.paymentMethod.findFirst({
    where: { id, userId: session.id, status: 'active' },
  })
  if (!method) {
    throw createError({ statusCode: 404, message: 'Payment method not found' })
  }

  const [remaining, activePlans, user] = await Promise.all([
    prisma.paymentMethod.count({
      where: { userId: session.id, status: 'active', id: { not: method.id } },
    }),
    prisma.installment.count({ where: { userId: session.id, status: { in: ['active', 'urgent'] } } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { autoPayInstallments: true } }),
  ])

  if (remaining === 0 && activePlans > 0 && user?.autoPayInstallments) {
    throw createError({
      statusCode: 400,
      message: 'This is your only payment method and you have an active instalment plan on auto-pay. '
        + 'Add another method first, or turn off auto-pay in your wallet settings.',
    })
  }

  // Cancel the mandate at the provider too — leaving a live Direct Debit
  // authority in place after the customer removed it here would be a real
  // breach of expectation (and of the Direct Debit Guarantee's spirit).
  if (method.kind === 'bacs_debit' && method.mandateStatus === 'active') {
    const provider = getProviderByName(method.provider as ProviderName)
    if (provider?.cancelMandate) {
      try {
        await provider.cancelMandate(method.providerMethodId)
      }
      catch (error: any) {
        // Do not block removal on a provider outage; the local record is
        // what governs our collection behaviour, and reconciliation will
        // surface a mandate that is still live upstream.
        log.error('mandate cancellation failed at provider', {
          methodId: method.id,
          provider: method.provider,
          message: error?.message,
        })
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentMethod.update({
      where: { id: method.id },
      data: { status: 'removed', isDefault: false, mandateStatus: method.kind === 'bacs_debit' ? 'cancelled' : method.mandateStatus },
    })

    // Promote another instrument so the account is never left defaultless.
    if (method.isDefault) {
      const next = await tx.paymentMethod.findFirst({
        where: { userId: session.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
      if (next) {
        await tx.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } })
      }
    }
  })

  log.info('payment method removed', { userId: session.id, methodId: method.id, kind: method.kind })
  return { status: 'success' }
})
