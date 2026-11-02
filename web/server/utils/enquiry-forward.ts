import type { ContactSubmission } from '#shared/contact'
import type { ForwardedEnquiry } from '#shared/enquiry'
import { ENQUIRY_SIGNATURE_HEADER, ENQUIRY_TIMESTAMP_HEADER, signEnquiry } from '#shared/enquiry'
import { contactBudgets, contactReplies, contactServiceLabels } from '../../app/data/contact'
import { cmsConfig } from './cms'

/**
 * Hands a contact message to the console, where it becomes an enquiry
 * staff work on (ADR-026, phase E). The console is on the same box in
 * production, so this is a loopback call; it is signed with
 * `NUXT_CMS_ENQUIRY_SECRET` because the console's route is otherwise open.
 * The labels the visitor picked go across as words, so the console never
 * needs the site's option lists.
 */

export function enquiryForwardConfigured(): boolean {
  const secret = (useRuntimeConfig().cms as { enquirySecret?: string } | undefined)?.enquirySecret ?? ''
  return Boolean(cmsConfig().url && secret)
}

export function forwardedEnquiry(id: string, message: ContactSubmission, source: string): ForwardedEnquiry {
  return {
    id,
    name: message.name,
    email: message.email,
    phone: message.phone,
    business: message.business,
    message: message.message,
    services: message.services.map(s => contactServiceLabels[s]),
    plan: message.plan,
    budget: message.budget ? contactBudgets[message.budget].label : '',
    reply: contactReplies[message.reply],
    source,
  }
}

/** Throws when the console did not store it; the caller decides what the visitor is told. */
export async function forwardEnquiry(enquiry: ForwardedEnquiry): Promise<void> {
  const secret = (useRuntimeConfig().cms as { enquirySecret?: string }).enquirySecret ?? ''
  const body = JSON.stringify(enquiry)
  // One retry with the same body: the id makes a second arrival a no-op if
  // the first was stored and only the answer was lost. Signed per attempt.
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    try {
      const res = await fetch(`${cmsConfig().url}/api/site/enquiries`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [ENQUIRY_TIMESTAMP_HEADER]: timestamp,
          [ENQUIRY_SIGNATURE_HEADER]: signEnquiry(secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(8_000),
      })
      if (res.ok) {
        return
      }
      lastError = Object.assign(new Error('Console refused the enquiry'), { statusCode: res.status })
      // A refusal (bad signature, invalid body) will not change on a retry.
      if (res.status < 500) {
        break
      }
    }
    catch (error) {
      lastError = error
    }
  }
  throw lastError
}
