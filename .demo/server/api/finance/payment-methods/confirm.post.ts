import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { providerFetch } from '../../../payments/client'
import { getProviderByName } from '../../../payments/registry'
import { requireAuth } from '../../../utils/auth'
import { createLogger } from '../../../utils/logger'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/payment-methods/confirm — finalise a card added through
 * Stripe Elements.
 *
 * The browser collected the card in Stripe's hosted iframe and confirmed the
 * SetupIntent; nothing sensitive passed through us (PCI DSS SAQ-A). What is
 * left is to make the saved row usable:
 *
 *  1. Re-read the SetupIntent from Stripe — the SERVER decides whether setup
 *     really succeeded. The client is never trusted for that.
 *  2. Adopt the real `pm_…` id. Setup stored the SetupIntent id as
 *     `providerMethodId`; every future charge must reference the PaymentMethod,
 *     so without this swap the instrument would be unchargeable. (Same shape as
 *     the GoCardless mandate hand-off in payments/service.ts.)
 *  3. Store display metadata (brand / last4 / expiry) so the wallet can render
 *     the card, and mark it default when appropriate.
 *
 * Ownership-checked: a customer can only confirm their own pending method.
 */

const log = createLogger('payment-methods:confirm')

const bodySchema = z.object({
  methodId: z.string().uuid(),
  setDefault: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { methodId, setDefault } = await validateBody(event, bodySchema)

  const method = await prisma.paymentMethod.findFirst({
    where: { id: methodId, userId: session.id, status: 'active' },
  })
  if (!method) {
    throw createError({ statusCode: 404, message: 'Payment method not found.' })
  }
  if (method.provider !== 'stripe' || (method.kind !== 'card' && method.kind !== 'bacs_debit')) {
    throw createError({ statusCode: 400, message: 'This payment method does not need confirmation.' })
  }
  // Already finalised (duplicate submit / refresh) — idempotent.
  if (method.last4) {
    return { status: 'active', method: publicShape(method) }
  }

  const provider = getProviderByName('stripe')
  if (!provider) {
    throw createError({ statusCode: 503, message: 'Card payments are not configured right now.' })
  }

  const { useRuntimeConfig } = await import('#imports')
  const secretKey = (useRuntimeConfig() as any).payments?.stripe?.secretKey
  if (!secretKey) {
    throw createError({ statusCode: 503, message: 'Card payments are not configured right now.' })
  }
  const headers = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  // 1. Authoritative read of the SetupIntent.
  const setupIntent = await providerFetch({
    provider: 'stripe',
    method: 'GET',
    url: `https://api.stripe.com/v1/setup_intents/${encodeURIComponent(method.providerMethodId)}?expand[]=payment_method`,
    headers,
  })

  const isBacs = method.kind === 'bacs_debit'

  // Bacs mandates are lodged with the bank over ~3 working days, so
  // `processing` is a normal, successful outcome here — the method is saved
  // but not yet chargeable. `setup_intent.succeeded` activates it later.
  const acceptable = isBacs
    ? ['succeeded', 'processing']
    : ['succeeded']

  if (!acceptable.includes(setupIntent.status)) {
    // Not set up: leave the row pending so a retry can finish it.
    const reason = setupIntent.last_setup_error?.message
    throw createError({
      statusCode: 402,
      message: reason || (isBacs
        ? 'Your Direct Debit could not be set up. Please check your bank details and try again.'
        : 'Your card could not be verified. Please check the details and try again.'),
    })
  }

  const pm = setupIntent.payment_method
  if (!pm || typeof pm !== 'object') {
    throw createError({ statusCode: 502, message: 'Stripe did not return the payment details. Please try again.' })
  }

  if (isBacs) {
    const bacs = pm.bacs_debit ?? {}
    const mandateStatus = setupIntent.status === 'succeeded' ? 'active' : 'submitted'
    const updatedBacs = await prisma.paymentMethod.update({
      where: { id: method.id },
      data: {
        providerMethodId: pm.id,
        providerCustomerId: typeof setupIntent.customer === 'string' ? setupIntent.customer : method.providerCustomerId,
        brand: 'Bank account',
        last4: bacs.last4 ?? null,
        accountHolder: pm.billing_details?.name ?? method.accountHolder,
        mandateStatus,
        // Only a live mandate may become the default instrument.
        isDefault: mandateStatus === 'active' && setDefault,
      },
    })
    if (updatedBacs.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { userId: session.id, id: { not: updatedBacs.id } },
        data: { isDefault: false },
      })
    }
    log.info('bacs mandate confirmed', { userId: session.id, methodId: updatedBacs.id, mandateStatus })
    return {
      status: mandateStatus === 'active' ? 'active' : 'pending',
      mandateStatus,
      method: publicShape(updatedBacs),
    }
  }

  const cardInfo = pm.card ?? {}

  // 2 + 3. Adopt the pm_… id and store display metadata.
  const shouldDefault = setDefault || (await prisma.paymentMethod.count({
    where: { userId: session.id, status: 'active', isDefault: true },
  })) === 0

  const updated = await prisma.paymentMethod.update({
    where: { id: method.id },
    data: {
      providerMethodId: pm.id,
      providerCustomerId: typeof setupIntent.customer === 'string' ? setupIntent.customer : method.providerCustomerId,
      brand: normaliseBrand(cardInfo.brand),
      last4: cardInfo.last4 ?? null,
      expMonth: cardInfo.exp_month ?? null,
      expYear: cardInfo.exp_year ?? null,
      isDefault: shouldDefault,
    },
  })

  if (shouldDefault) {
    await prisma.paymentMethod.updateMany({
      where: { userId: session.id, id: { not: updated.id } },
      data: { isDefault: false },
    })
  }

  log.info('card confirmed', { userId: session.id, methodId: updated.id, brand: updated.brand })

  return { status: 'active', method: publicShape(updated) }
})

/** Stripe's lowercase brand slugs → the labels the UI shows. */
function normaliseBrand(brand?: string): string {
  switch (brand) {
    case 'visa':
      return 'Visa'
    case 'mastercard':
      return 'Mastercard'
    case 'amex':
      return 'American Express'
    case 'discover':
      return 'Discover'
    default:
      return brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card'
  }
}

function publicShape(m: {
  id: string
  kind: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  mandateStatus?: string | null
  isDefault: boolean
}) {
  return {
    id: m.id,
    kind: m.kind,
    brand: m.brand,
    last4: m.last4,
    expMonth: m.expMonth,
    expYear: m.expYear,
    mandateStatus: m.mandateStatus ?? null,
    isDefault: m.isDefault,
  }
}
