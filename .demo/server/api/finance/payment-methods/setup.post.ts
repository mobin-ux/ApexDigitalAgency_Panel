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
 * POST /api/finance/payment-methods/setup — begin adding a payment method.
 *
 * This is the whole "Add payment method" workflow's server half, and the
 * important thing about it is what it does NOT do: it never receives a card
 * number, sort code or account number. It asks the provider to host that
 * collection and returns where to send the customer.
 *
 *   kind=bacs_debit → GoCardless Billing Request Flow (hosted mandate page)
 *   kind=card       → Stripe SetupIntent (client secret for Elements)
 *
 * The row is created in a pending state up front so an abandoned flow is
 * visible and reconcilable rather than invisible. It only becomes usable
 * when the provider confirms — via webhook for mandates, or the confirm
 * endpoint for cards.
 */

const log = createLogger('payment-methods:setup')

const bodySchema = z.object({
  kind: z.enum(['card', 'bacs_debit']),
  /** Where the provider returns the customer after a hosted flow. */
  returnUrl: z.string().max(500).optional(),
  /** Make this the default instrument once it becomes usable. */
  setDefault: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.payment, bucket: 'payment:setup', identity: session.id })

  const { kind, returnUrl, setDefault } = await validateBody(event, bodySchema)

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { email: true, firstName: true, lastName: true },
  })
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined

  // Guard against instrument-hoarding: a bounded number per account keeps
  // the provider bill and the UI sane.
  const existing = await prisma.paymentMethod.count({
    where: { userId: session.id, status: 'active' },
  })
  if (existing >= 10) {
    throw createError({
      statusCode: 400,
      message: 'You have reached the maximum of 10 saved payment methods. Remove one first.',
    })
  }

  const provider = await getProvider(kind === 'bacs_debit' ? 'mandate' : 'charge')
  const reference = `APX-PM-${randomBytes(4).toString('hex').toUpperCase()}`
  const idempotencyKey = `${reference}-${randomUUID()}`

  if (kind === 'bacs_debit') {
    if (!provider.createMandate) {
      throw createError({
        statusCode: 501,
        message: 'Direct debit is not available right now. Please use a card.',
      })
    }

    const mandate = await provider.createMandate({
      customer: { userId: session.id, email: user.email, name },
      reference,
      idempotencyKey,
      returnUrl: returnUrl ?? '/dashboards/wallet?tab=banking',
      description: 'Apex Digi instalment plan mandate',
    })

    const record = await prisma.paymentMethod.create({
      data: {
        userId: session.id,
        provider: provider.name,
        kind: 'bacs_debit',
        providerMethodId: mandate.providerMethodId,
        brand: mandate.brand,
        last4: mandate.last4,
        accountHolder: mandate.accountHolder ?? name,
        mandateStatus: mandate.status,
        // Not active until the mandate is — see the webhook handler.
        isDefault: false,
        status: 'active',
      },
    })

    log.info('mandate setup started', { userId: session.id, methodId: record.id, provider: provider.name })

    // Two provider models, one response shape:
    //  - clientSecret → the bank details are collected in embedded provider
    //    fields (Stripe Bacs via Elements) and confirmed client-side.
    //  - redirectUrl  → the provider hosts the whole authorisation page
    //    (GoCardless Billing Request Flow).
    return {
      status: mandate.clientSecret ? 'requires_confirmation' : 'pending',
      methodId: record.id,
      kind: 'bacs_debit',
      clientSecret: mandate.clientSecret,
      redirectUrl: mandate.redirectUrl,
      setDefaultRequested: setDefault,
      message: mandate.clientSecret
        ? 'Enter your bank details to authorise the Direct Debit.'
        : 'Complete the Direct Debit authorisation with your bank to activate this method.',
    }
  }

  // --- Card: Stripe SetupIntent -------------------------------------------
  // Saving a card without charging it is a SetupIntent, not a PaymentIntent.
  // The mock rail has no such concept, so it reports the method immediately
  // usable — which is exactly the behaviour we want locally.
  if (provider.name === 'mock') {
    const record = await prisma.paymentMethod.create({
      data: {
        userId: session.id,
        provider: 'mock',
        kind: 'card',
        providerMethodId: `mock_pm_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
        brand: 'Mock Card',
        last4: '4242',
        expMonth: 12,
        expYear: new Date().getFullYear() + 3,
        accountHolder: name,
        isDefault: setDefault || existing === 0,
        status: 'active',
      },
    })
    if (record.isDefault) {
      await clearOtherDefaults(session.id, record.id)
    }
    return {
      status: 'active',
      methodId: record.id,
      kind: 'card',
      message: 'Test card saved. Configure a real provider to collect actual cards.',
    }
  }

  const setup = await createStripeSetupIntent(provider.name, session.id, user.email, name, idempotencyKey)

  const record = await prisma.paymentMethod.create({
    data: {
      userId: session.id,
      provider: provider.name,
      kind: 'card',
      providerCustomerId: setup.customerId,
      providerMethodId: setup.setupIntentId,
      accountHolder: name,
      // Card details land on confirm; nothing to display yet.
      status: 'active',
      isDefault: false,
    },
  })

  log.info('card setup started', { userId: session.id, methodId: record.id })

  return {
    status: 'requires_confirmation',
    methodId: record.id,
    kind: 'card',
    // Stripe Elements confirms client-side with this; it is scoped to this
    // single SetupIntent and is safe to send to the browser.
    clientSecret: setup.clientSecret,
    publishableKeyRequired: true,
    setDefaultRequested: setDefault,
  }
})

async function clearOtherDefaults(userId: string, keepId: string) {
  await prisma.paymentMethod.updateMany({
    where: { userId, id: { not: keepId } },
    data: { isDefault: false },
  })
}

/**
 * Stripe SetupIntents are not part of the PaymentProvider interface — they
 * are a card-specific concept, and pushing them into the shared contract
 * would make every non-card adapter implement something meaningless. This
 * stays local to the card path.
 */
async function createStripeSetupIntent(
  providerName: string,
  userId: string,
  email: string,
  name: string | undefined,
  idempotencyKey: string,
): Promise<{ clientSecret: string, setupIntentId: string, customerId: string }> {
  const { useRuntimeConfig } = await import('#imports')
  const { formEncode, providerFetch } = await import('../../../payments/client')

  const secretKey = (useRuntimeConfig() as any).payments?.stripe?.secretKey
  if (!secretKey) {
    throw createError({ statusCode: 503, message: 'Card payments are not configured yet.' })
  }

  const headers = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Idempotency-Key': idempotencyKey,
  }

  // A Stripe Customer is what lets the saved card be reused off-session for
  // future instalments — without one the SetupIntent has nothing to attach to.
  const customer = await providerFetch({
    provider: 'stripe',
    method: 'POST',
    url: 'https://api.stripe.com/v1/customers',
    headers,
    body: formEncode({ email, name, metadata: { apex_user_id: userId } }),
  })

  const setupIntent = await providerFetch({
    provider: 'stripe',
    method: 'POST',
    url: 'https://api.stripe.com/v1/setup_intents',
    headers: { ...headers, 'Idempotency-Key': `${idempotencyKey}-si` },
    body: formEncode({
      customer: customer.id,
      // Declares intent to charge later without the customer present, which
      // is what makes the saved card valid for instalment collection.
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: { apex_user_id: userId },
    }),
  })

  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    customerId: customer.id,
  }
}
