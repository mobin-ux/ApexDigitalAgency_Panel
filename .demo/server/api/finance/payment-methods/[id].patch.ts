import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import { createLogger } from '../../../utils/logger'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/finance/payment-methods/:id
 *
 *   action=confirm      finish a card setup after Stripe Elements succeeded
 *   action=set_default  make this the instrument used for auto-collection
 *
 * Every branch is ownership-scoped by `userId` in the WHERE clause, so a
 * guessed id belonging to another customer resolves to 404, never to
 * someone else's payment method.
 */

const log = createLogger('payment-methods')

const bodySchema = z.object({
  action: z.enum(['confirm', 'set_default']),
  /** Stripe payment_method id produced by client-side confirmation. */
  providerMethodId: z.string().max(200).optional(),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Payment method id is required' })
  }

  const { action, providerMethodId } = await validateBody(event, bodySchema)

  const method = await prisma.paymentMethod.findFirst({
    where: { id, userId: session.id, status: 'active' },
  })
  if (!method) {
    throw createError({ statusCode: 404, message: 'Payment method not found' })
  }

  if (action === 'confirm') {
    if (!providerMethodId) {
      throw createError({ statusCode: 400, message: 'providerMethodId is required to confirm a card' })
    }

    // Read the card's display details from the provider rather than trusting
    // the client: the browser could claim any brand or last4 it liked, and
    // those values are shown to the customer as the identity of the card.
    const details = await fetchCardDetails(method.provider, providerMethodId)

    const updated = await prisma.paymentMethod.update({
      where: { id: method.id },
      data: {
        providerMethodId,
        brand: details.brand,
        last4: details.last4,
        expMonth: details.expMonth,
        expYear: details.expYear,
      },
    })

    // First instrument on the account becomes the default automatically.
    const count = await prisma.paymentMethod.count({ where: { userId: session.id, status: 'active' } })
    if (count === 1) {
      await prisma.paymentMethod.update({ where: { id: updated.id }, data: { isDefault: true } })
    }

    log.info('card confirmed', { userId: session.id, methodId: updated.id, brand: details.brand })
    return { status: 'success', method: publicView({ ...updated, isDefault: count === 1 }) }
  }

  // --- set_default ---------------------------------------------------------
  if (method.kind === 'bacs_debit' && method.mandateStatus !== 'active') {
    throw createError({
      statusCode: 400,
      message: 'This Direct Debit mandate is not active yet, so it cannot be the default.',
    })
  }

  // Both writes in one transaction: a failure between them would leave the
  // account with two defaults or none.
  await prisma.$transaction([
    prisma.paymentMethod.updateMany({
      where: { userId: session.id, id: { not: method.id } },
      data: { isDefault: false },
    }),
    prisma.paymentMethod.update({ where: { id: method.id }, data: { isDefault: true } }),
  ])

  log.info('default payment method changed', { userId: session.id, methodId: method.id })
  return { status: 'success', method: publicView({ ...method, isDefault: true }) }
})

function publicView(method: any) {
  return {
    id: method.id,
    kind: method.kind,
    brand: method.brand,
    last4: method.last4,
    expMonth: method.expMonth,
    expYear: method.expYear,
    mandateStatus: method.mandateStatus,
    isDefault: method.isDefault,
  }
}

/** Card metadata straight from the provider — never from the client. */
async function fetchCardDetails(provider: string, providerMethodId: string) {
  if (provider === 'mock') {
    return { brand: 'Mock Card', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 3 }
  }

  const { useRuntimeConfig } = await import('#imports')
  const { providerFetch } = await import('../../../payments/client')
  const secretKey = (useRuntimeConfig() as any).payments?.stripe?.secretKey
  if (!secretKey) {
    throw createError({ statusCode: 503, message: 'Card payments are not configured.' })
  }

  const pm = await providerFetch({
    provider: 'stripe',
    method: 'GET',
    url: `https://api.stripe.com/v1/payment_methods/${encodeURIComponent(providerMethodId)}`,
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  return {
    brand: pm.card?.brand ?? 'Card',
    last4: pm.card?.last4 ?? null,
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
  }
}
