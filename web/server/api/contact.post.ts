import { validateContact } from '#shared/contact'
import { contactMailConfigured, sendContactMail } from '../utils/contact-mail'

/**
 * POST /api/contact: the site's only write. Layered defences, cheapest first:
 *   - nuxt-security (route rules in nuxt.config.ts) allows POST here alone,
 *     caps the body at 16 KB and rate-limits each IP;
 *   - same-origin only: a cross-site page cannot post here, because a JSON
 *     body needs a CORS preflight this site never answers, and the browser's
 *     own `Sec-Fetch-Site` is checked as well;
 *   - a honeypot field bots fill in and people never see;
 *   - the shared validator the page uses, so both sides agree on every rule.
 *
 * Answers: 200 delivered · 422 field errors · 503 no mail provider configured
 * · 502 the provider failed. The page treats 502/503 as "not sent" and offers
 * the visitor's own email instead, so nothing claims to have arrived.
 */
export default defineEventHandler(async (event) => {
  const site = getHeader(event, 'sec-fetch-site')
  if (site && site !== 'same-origin') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site requests are not accepted' })
  }
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Send JSON' })
  }

  const body = await readBody<Record<string, unknown>>(event)

  // A filled honeypot is a bot. Answer as if it worked so it learns nothing.
  if (typeof body?.fax === 'string' && body.fax.trim()) {
    return { delivered: true }
  }

  const result = validateContact(body)
  if (!result.ok) {
    throw createError({ statusCode: 422, statusMessage: 'Check the marked fields', data: { errors: result.errors } })
  }

  const config = useRuntimeConfig(event).contact
  if (!contactMailConfigured(config)) {
    throw createError({ statusCode: 503, statusMessage: 'Contact delivery is not configured' })
  }

  try {
    await sendContactMail(config, result.data)
  }
  catch (error: unknown) {
    // Log the failure, never the message: it is a visitor's personal data.
    console.error('[contact] delivery failed', (error as { statusCode?: number }).statusCode ?? (error as Error).name)
    throw createError({ statusCode: 502, statusMessage: 'Delivery failed' })
  }

  return { delivered: true }
})
