import type { ContactSubmission } from '#shared/contact'
import { contactBudgets, contactReplies, contactServiceLabels } from '../../app/data/contact'

/**
 * Delivers a contact message to the team's inbox. One provider today
 * (Resend, over its REST API with no SDK); another is a second function with
 * the same signature. Nothing is sent to the visitor: an automatic reply from
 * a public form can be pointed at anyone's address.
 */

export interface ContactMailConfig {
  resendApiKey: string
  to: string
  from: string
}

export function contactMailConfigured(config: ContactMailConfig): boolean {
  return Boolean(config.resendApiKey && config.to && config.from)
}

/** The plain-text body the team reads. Labels are the ones the visitor picked from. */
export function contactMailText(message: ContactSubmission): string {
  const rows: [string, string][] = [
    ['Name', message.name],
    ['Email', message.email],
    ['Phone', message.phone],
    ['Business', message.business],
    ['Services', message.services.map(id => contactServiceLabels[id]).join(', ')],
    ['Plan', message.plan],
    ['Budget', message.budget ? contactBudgets[message.budget].label : ''],
    ['Reply by', contactReplies[message.reply]],
  ]
  const details = rows.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`)
  return [...details, '', message.message || '(No message)'].join('\n')
}

export async function sendContactMail(config: ContactMailConfig, message: ContactSubmission): Promise<void> {
  // Header values cannot carry line breaks; the name is the only visitor text in one.
  const name = message.name.replace(/[\r\n]+/g, ' ')
  await $fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resendApiKey}`,
      // The retry below re-sends a POST. If the first attempt reached Resend
      // and only the answer was lost (a timeout), the same key makes Resend
      // treat the retry as that send instead of emailing the team twice.
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: {
      from: config.from,
      to: [config.to],
      reply_to: message.email,
      subject: `Website enquiry from ${name}`,
      text: contactMailText(message),
    },
    timeout: 10_000,
    retry: 1,
  })
}
