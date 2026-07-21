import { createError, defineEventHandler, getRequestHeaders, getRouterParam, readRawBody, setResponseStatus } from 'h3'
import { normaliseGoCardlessBatch } from '../../payments/gocardless'
import { getProviderByName } from '../../payments/registry'
import { applyWebhookEvent } from '../../payments/service'
import { type NormalisedEvent, type ProviderName, WebhookSignatureError } from '../../payments/types'
import { createLogger } from '../../utils/logger'
import prisma from '../../utils/prisma'

/**
 * POST /api/webhooks/:provider — the only unauthenticated write endpoints
 * in the application. The HMAC signature IS the authentication (ADR-015 §7).
 *
 * Non-negotiables, in order:
 *  1. RAW body. Parsing before verifying breaks every signature scheme.
 *  2. Verify, then reject with 400 on failure — never process unverified data.
 *  3. Persist under a unique (provider, providerEventId) key. Stripe and
 *     GoCardless deliver AT LEAST ONCE and retry for up to 72 hours, so
 *     duplicates are ordinary traffic, not an error condition.
 *  4. Acknowledge 200 fast. A provider that times out marks the endpoint
 *     unhealthy and eventually disables it.
 *
 * Nothing outside the verified payload is trusted — not query params, not
 * headers beyond the signature, not the body's own claims about who it is.
 */

const log = createLogger('webhooks')
const SUPPORTED: ProviderName[] = ['stripe', 'gocardless', 'paypal', 'mock']

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'provider') as ProviderName | undefined
  if (!name || !SUPPORTED.includes(name)) {
    throw createError({ statusCode: 404, message: 'Unknown payment provider' })
  }

  const provider = getProviderByName(name)
  if (!provider) {
    // Configured endpoint, absent credentials — tell the provider to retry
    // rather than silently dropping real events.
    log.error('webhook received for unconfigured provider', { provider: name })
    throw createError({ statusCode: 503, message: 'Provider not configured' })
  }

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) {
    throw createError({ statusCode: 400, message: 'Empty webhook body' })
  }

  const headers = getRequestHeaders(event) as Record<string, string | undefined>

  let events: NormalisedEvent[]
  try {
    const first = await provider.verifyWebhook(rawBody, headers)
    // GoCardless batches many events per request; the others send one.
    events = name === 'gocardless' ? normaliseGoCardlessBatch(rawBody) : [first]
  }
  catch (error: any) {
    if (error instanceof WebhookSignatureError) {
      // Logged as a security event: a bad signature is either a
      // misconfiguration or someone probing the endpoint.
      log.error('webhook signature rejected', { provider: name, message: error.message })
      throw createError({ statusCode: 400, message: 'Invalid signature' })
    }
    log.error('webhook verification failed', { provider: name, message: error?.message })
    throw createError({ statusCode: 400, message: 'Webhook could not be verified' })
  }

  let processed = 0
  let duplicates = 0

  for (const normalised of events) {
    // The unique constraint is the idempotency guarantee — we attempt the
    // insert and treat a collision as "already seen", rather than checking
    // first (which races with a concurrent duplicate delivery).
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: name,
          providerEventId: normalised.providerEventId,
          type: normalised.type,
          payload: rawBody.slice(0, 100_000),
          signatureValid: true,
          status: 'received',
        },
      })
    }
    catch (error: any) {
      if (error?.code === 'P2002') {
        duplicates++
        log.debug('duplicate webhook ignored', { provider: name, eventId: normalised.providerEventId })
        continue
      }
      throw error
    }

    try {
      await applyWebhookEvent(name, normalised)
      await prisma.webhookEvent.updateMany({
        where: { provider: name, providerEventId: normalised.providerEventId },
        data: { status: 'processed', processedAt: new Date(), attempts: { increment: 1 } },
      })
      processed++
    }
    catch (error: any) {
      // The event is stored, so this is replayable from the admin tools
      // rather than lost. We still 200 the provider: retrying delivery of an
      // event we already hold does not help.
      await prisma.webhookEvent.updateMany({
        where: { provider: name, providerEventId: normalised.providerEventId },
        data: { status: 'failed', lastError: String(error?.message).slice(0, 500), attempts: { increment: 1 } },
      })
      log.error('webhook handler failed', { provider: name, eventId: normalised.providerEventId, type: normalised.type, message: error?.message })
    }
  }

  log.info('webhook batch handled', { provider: name, received: events.length, processed, duplicates })

  setResponseStatus(event, 200)
  return { received: events.length, processed, duplicates }
})
