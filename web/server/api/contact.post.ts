import { randomUUID } from 'node:crypto'
import { validateContact } from '#shared/contact'
import { enquirySource } from '#shared/enquiry'
import { writeLog } from '#shared/log'
import { fetchSettings } from '../utils/cms'
import { contactMailConfigured, sendContactMail } from '../utils/contact-mail'
import { enquiryForwardConfigured, forwardedEnquiry, forwardEnquiry } from '../utils/enquiry-forward'

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
 * A message goes two ways (ADR-026, phase E): stored in the console as an
 * enquiry over a signed call, and emailed to the team. Either one arriving
 * is a delivered message; the visitor is told otherwise only when neither
 * did. No IP address or other visitor metadata is passed on, only what
 * they typed and the page they sent it from.
 *
 * Answers: 200 delivered · 422 field errors · 503 neither route configured
 * · 502 every configured route failed. The page treats 502/503 as "not
 * sent" and offers the visitor's own email instead, so nothing claims to
 * have arrived.
 */
export default defineEventHandler(async (event) => {
  const site = getHeader(event, 'sec-fetch-site')
  if (site && site !== 'same-origin') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-site requests are not accepted' })
  }
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Send JSON' })
  }

  // Maintenance mode (Site settings) stops the form taking enquiries.
  if ((await fetchSettings())?.maintenance) {
    throw createError({ statusCode: 503, statusMessage: 'The site is down for maintenance' })
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

  const mail = useRuntimeConfig(event).contact
  const store = enquiryForwardConfigured()
  const email = contactMailConfigured(mail)
  if (!store && !email) {
    throw createError({ statusCode: 503, statusMessage: 'Contact delivery is not configured' })
  }

  const [stored, emailed] = await Promise.allSettled([
    store ? forwardEnquiry(forwardedEnquiry(randomUUID(), result.data, enquirySource(body.source))) : Promise.reject(new Error('off')),
    email ? sendContactMail(mail, result.data) : Promise.reject(new Error('off')),
  ])
  // Log the outcome, never the message: it is a visitor's personal data.
  if (store && stored.status === 'rejected') {
    writeLog({ level: 'error', category: 'customer', event: 'site.contact.store-failed', message: 'Storing the enquiry in the console failed', outcome: 'failure', error: stored.reason })
  }
  if (email && emailed.status === 'rejected') {
    writeLog({ level: 'error', category: 'mail', event: 'site.contact.email-failed', message: 'Emailing the enquiry failed', outcome: 'failure', error: emailed.reason })
  }
  const delivered = stored.status === 'fulfilled' || emailed.status === 'fulfilled'
  writeLog({
    level: delivered ? 'info' : 'error',
    category: 'customer',
    event: 'site.contact.received',
    message: delivered ? 'Contact message delivered' : 'Contact message could not be delivered',
    outcome: delivered ? 'success' : 'failure',
    data: { stored: stored.status === 'fulfilled', emailed: emailed.status === 'fulfilled', services: result.data.services.length, source: enquirySource(body.source) },
  })
  if (!delivered) {
    throw createError({ statusCode: 502, statusMessage: 'Delivery failed' })
  }

  return { delivered: true }
})
