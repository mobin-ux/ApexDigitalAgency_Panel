/**
 * The one provider call (ADR-022): Resend, over its REST API with no SDK,
 * the same way the public site's contact form sends. One attempt per call;
 * the outbox decides whether and when to try again. The Idempotency-Key is
 * the outbox row's id, so a retry of a message whose acceptance was lost in
 * transit cannot deliver it twice.
 *
 * Nothing here logs an address, a subject or a body.
 */

export interface MailRuntime {
  resendApiKey: string
  from: string
}

export const MAIL_ENV_KEYS = ['NUXT_MAIL_RESEND_API_KEY', 'NUXT_MAIL_FROM'] as const

/** 5xx and 429 are worth retrying; a 4xx means we sent something wrong (or the domain is not verified). */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

const TIMEOUT_MS = 10_000

export function mailRuntime(): MailRuntime {
  const config = useRuntimeConfig().mail as Partial<MailRuntime> | undefined
  return { resendApiKey: (config?.resendApiKey ?? '').trim(), from: (config?.from ?? '').trim() }
}

/** Both keys set. The outbox marks rows failed instead of calling the provider while this is false. */
export function mailConfigured(): boolean {
  const { resendApiKey, from } = mailRuntime()
  return Boolean(resendApiKey && from)
}

export class MailTransportError extends Error {
  constructor(message: string, public readonly retryable: boolean, public readonly status?: number) {
    super(message)
    this.name = 'MailTransportError'
  }
}

export interface OutgoingMail {
  id: string
  to: string
  subject: string
  text: string
  html: string
  replyTo: string | null
}

export async function sendViaResend(mail: OutgoingMail): Promise<{ providerId: string }> {
  const { resendApiKey, from } = mailRuntime()
  if (!resendApiKey || !from) {
    throw new MailTransportError('Mail is not configured', false)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${resendApiKey}`,
        'idempotency-key': `mail-${mail.id}`,
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: controller.signal,
    })
  }
  catch (error) {
    clearTimeout(timer)
    const aborted = (error as Error).name === 'AbortError'
    throw new MailTransportError(aborted ? `Resend did not answer within ${TIMEOUT_MS / 1000} seconds` : `Could not reach Resend: ${(error as Error).message}`, true)
  }
  clearTimeout(timer)

  const body = await res.json().catch(() => null) as { id?: unknown, message?: unknown } | null
  if (!res.ok) {
    const message = typeof body?.message === 'string' ? body.message : `Resend answered ${res.status}`
    throw new MailTransportError(message.slice(0, 300), RETRYABLE_STATUS.has(res.status), res.status)
  }
  const providerId = typeof body?.id === 'string' ? body.id : ''
  if (!providerId) {
    throw new MailTransportError('Resend accepted the message but returned no id', true, res.status)
  }
  return { providerId }
}
