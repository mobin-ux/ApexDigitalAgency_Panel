import { randomBytes, randomUUID } from 'node:crypto'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { getProvider } from '../../../payments/registry'
import { requireAuth } from '../../../utils/auth'
import { createLogger } from '../../../utils/logger'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/payment-methods/bank — set up a UK Direct Debit mandate
 * from bank details entered in the app's own form (sandbox rail only).
 *
 * Storage posture: the sort code and account number authorise the mandate but
 * are NOT persisted in full — only the last four digits of the account and the
 * sort code (which identifies the bank branch, not a secret) are kept for
 * display. The `.strict()` schema means nothing else can be smuggled in.
 *
 * As with cards, this inline path is used only when the mandate capability
 * resolves to the mock provider. When GoCardless is connected the client is
 * told (`pay-config.bankEntry === 'hosted'`) to authorise on GoCardless's own
 * Billing Request Flow page (which also satisfies the Direct Debit scheme's
 * requirement that the customer authorise directly with an approved provider).
 */

const log = createLogger('payment-methods:bank')

const bodySchema = z.object({
  accountHolder: z.string().trim().min(2).max(120),
  // 6 digits; the UI sends them without dashes.
  sortCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit sort code'),
  // UK account numbers are 8 digits.
  accountNumber: z.string().regex(/^\d{8}$/, 'Enter a valid 8-digit account number'),
  // The Direct Debit authority — the customer confirms they may authorise
  // debits on this account. Required to create a mandate.
  authorised: z.literal(true),
  setDefault: z.boolean().default(false),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.payment, bucket: 'payment:bank', identity: session.id })

  const body = await validateBody(event, bodySchema)

  const provider = await getProvider('mandate')
  if (provider.name !== 'mock') {
    throw createError({
      statusCode: 409,
      message: 'Please authorise your Direct Debit securely with our bank partner.',
    })
  }
  if (!provider.createMandate) {
    throw createError({ statusCode: 501, message: 'Direct Debit is not available right now. Please use a card.' })
  }

  const count = await prisma.paymentMethod.count({ where: { userId: session.id, status: 'active' } })
  if (count >= 10) {
    throw createError({ statusCode: 400, message: 'You have reached the maximum of 10 saved payment methods. Remove one first.' })
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { email: true } })
  const reference = `APX-DD-${randomBytes(4).toString('hex').toUpperCase()}`

  // Hand the mandate to the rail (mock here). A live provider would collect the
  // details itself; we pass none — the details never leave this request.
  await provider.createMandate({
    customer: { userId: session.id, email: user.email, name: body.accountHolder },
    reference,
    idempotencyKey: `${reference}-${randomUUID()}`,
    returnUrl: '/dashboards/wallet?tab=banking',
    description: 'Apex Digi Direct Debit mandate',
  })

  const last4 = body.accountNumber.slice(-4)
  const makeDefault = body.setDefault || count === 0

  const method = await prisma.paymentMethod.create({
    data: {
      userId: session.id,
      provider: 'mock',
      kind: 'bacs_debit',
      providerMethodId: `mock_md_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      brand: 'Bank account',
      last4,
      accountHolder: body.accountHolder,
      // Authorised inline in the sandbox flow, so it is immediately usable.
      // A live mandate would sit 'pending_submission' until the scheme confirms.
      mandateStatus: 'active',
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

  log.info('sandbox mandate created', { userId: session.id, methodId: method.id, reference })

  return {
    status: 'active',
    reference,
    method: {
      id: method.id,
      kind: method.kind,
      brand: method.brand,
      last4: method.last4,
      accountHolder: method.accountHolder,
      mandateStatus: method.mandateStatus,
      isDefault: method.isDefault,
      sortCodeMasked: `${body.sortCode.slice(0, 2)}-••-••`,
    },
  }
})
