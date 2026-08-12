import { randomUUID } from 'node:crypto'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { getProvider } from '../../../payments/registry'
import { requireAuth } from '../../../utils/auth'
import { createLogger } from '../../../utils/logger'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/payment-methods/card — save a card entered in the app's
 * own UK card form (sandbox rail only).
 *
 * PCI posture: this endpoint receives DISPLAY METADATA ONLY — brand, last four
 * digits, expiry and the cardholder name. The full card number and CVC are
 * validated and "tokenised" in the browser and never sent here. The schema is
 * `.strict()`, so a request that smuggled a `number`/`pan`/`cvc` field would be
 * rejected outright — our servers, logs and database stay PAN-free (SAQ-A).
 *
 * This path is used only when the charge capability resolves to the mock
 * provider (no real credentials). When a real provider is connected the client
 * is told (`pay-config.cardEntry === 'hosted'`) to collect the card in the
 * provider's hosted fields (Stripe Elements) via payment-methods/setup instead,
 * and this endpoint refuses so a real card can never be taken outside the
 * compliant flow.
 */

const log = createLogger('payment-methods:card')

const bodySchema = z.object({
  brand: z.enum(['visa', 'mastercard', 'amex']),
  last4: z.string().regex(/^\d{4}$/, 'last4 must be exactly four digits'),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2000).max(2100),
  accountHolder: z.string().trim().min(2).max(120),
  billingPostcode: z.string().trim().min(2).max(12).optional(),
  // Opaque client-side token standing in for a provider token. Never a PAN.
  token: z.string().trim().min(8).max(120),
  setDefault: z.boolean().default(false),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.payment, bucket: 'payment:card', identity: session.id })

  const body = await validateBody(event, bodySchema)

  // Expiry must be in the future (last day of the expiry month).
  const now = new Date()
  const expiry = new Date(body.expYear, body.expMonth, 1)
  if (expiry <= now) {
    throw createError({ statusCode: 400, message: 'This card has expired. Please use a valid card.' })
  }

  const provider = await getProvider('charge')
  if (provider.name !== 'mock') {
    // A real card must be tokenised in the provider's hosted fields.
    throw createError({
      statusCode: 409,
      message: 'Card details must be entered securely with our payment provider. Please use the secure card form.',
    })
  }

  const count = await prisma.paymentMethod.count({ where: { userId: session.id, status: 'active' } })
  if (count >= 10) {
    throw createError({ statusCode: 400, message: 'You have reached the maximum of 10 saved payment methods. Remove one first.' })
  }

  const makeDefault = body.setDefault || count === 0
  const brandLabel = body.brand === 'amex' ? 'American Express' : body.brand === 'mastercard' ? 'Mastercard' : 'Visa'

  const method = await prisma.paymentMethod.create({
    data: {
      userId: session.id,
      provider: 'mock',
      kind: 'card',
      // A stand-in for the provider token; the real token would come from the
      // hosted flow. Prefixed so it is obviously not a real instrument.
      providerMethodId: `mock_pm_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      brand: brandLabel,
      last4: body.last4,
      expMonth: body.expMonth,
      expYear: body.expYear,
      accountHolder: body.accountHolder,
      isDefault: makeDefault,
      status: 'active',
    },
  })

  if (makeDefault) {
    await prisma.paymentMethod.updateMany({
      where: { userId: session.id, id: { not: method.id } },
      data: { isDefault: false },
    })
  }

  log.info('sandbox card saved', { userId: session.id, methodId: method.id, brand: brandLabel })

  return {
    status: 'active',
    method: {
      id: method.id,
      kind: method.kind,
      brand: method.brand,
      last4: method.last4,
      expMonth: method.expMonth,
      expYear: method.expYear,
      isDefault: method.isDefault,
    },
  }
})
