import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The signed call that hands a contact message from the site to the console
 * (ADR-026, phase E). Server code only, on both sides: the site signs, the
 * panel checks. The panel imports this file by relative path through
 * `.demo/shared/enquiry.ts`, so there is one definition of the signature.
 *
 * The signature is an HMAC-SHA256 of `<timestamp>.<raw body>` with the
 * shared secret (site `NUXT_CMS_ENQUIRY_SECRET`, panel
 * `NUXT_WEBSITE_ENQUIRY_SECRET`). The timestamp is in the signed text and
 * must be within five minutes of the panel's clock, so a captured request
 * cannot be replayed later; `id` makes a retried request store once.
 */

export const ENQUIRY_TIMESTAMP_HEADER = 'x-apex-timestamp'
export const ENQUIRY_SIGNATURE_HEADER = 'x-apex-signature'
export const ENQUIRY_TOLERANCE_SECONDS = 300
/** A forwarded message is a contact form's worth of text, well under this. */
export const ENQUIRY_MAX_BYTES = 32 * 1024

/** What the site sends: the visitor's words, with the options they picked already turned into their labels. */
export interface ForwardedEnquiry {
  id: string
  name: string
  email: string
  phone: string
  business: string
  message: string
  services: string[]
  plan: string
  budget: string
  reply: string
  source: string
}

export function signEnquiry(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyEnquirySignature(secret: string, timestamp: string | undefined, signature: string | undefined, body: string, now = Date.now()): boolean {
  if (!secret || !timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) {
    return false
  }
  if (Math.abs(now / 1000 - Number(timestamp)) > ENQUIRY_TOLERANCE_SECONDS) {
    return false
  }
  const expected = Buffer.from(signEnquiry(secret, timestamp, body), 'hex')
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The page's own address, trimmed to a path and query on this site; anything else is dropped. */
export function enquirySource(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return ''
  }
  return value.replace(/[\r\n\t]/g, '').slice(0, 300)
}
