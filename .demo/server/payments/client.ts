import { createLogger } from '../utils/logger'
import { PaymentProviderError, type ProviderName } from './types'

/**
 * Shared HTTP transport for the provider adapters.
 *
 * Every provider call gets: a hard timeout (a hung gateway must not hold a
 * request open), bounded retries with exponential backoff + jitter on
 * transient failures only, and structured logging that never echoes
 * credentials. Retries are safe because every mutating call carries an
 * idempotency key (ADR-015 §7).
 */

const log = createLogger('payments:http')

/** 5xx and 429 are worth retrying; 4xx means we sent something wrong. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

export interface ProviderRequest {
  provider: ProviderName
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  headers?: Record<string, string>
  /** Form-encoded (Stripe) or JSON (GoCardless, PayPal) — set by the adapter. */
  body?: string
  timeoutMs?: number
  maxAttempts?: number
}

export async function providerFetch<T = any>(req: ProviderRequest): Promise<T> {
  const { provider, method, url, headers = {}, body } = req
  const timeoutMs = req.timeoutMs ?? 15_000
  const maxAttempts = req.maxAttempts ?? 3

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const startedAt = Date.now()

    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal })
      const text = await response.text()
      const durationMs = Date.now() - startedAt

      if (response.ok) {
        log.debug('provider call ok', { provider, method, url, status: response.status, durationMs, attempt })
        return (text ? JSON.parse(text) : {}) as T
      }

      const parsed = safeJson(text)
      const { code, message } = extractError(parsed, response.status)
      const retryable = RETRYABLE_STATUS.has(response.status)

      log.warn('provider call failed', { provider, method, url, status: response.status, code, message, attempt, retryable })

      if (!retryable || attempt === maxAttempts) {
        throw new PaymentProviderError(message, provider, code, response.status >= 500 ? 502 : 400, retryable)
      }
      lastError = new PaymentProviderError(message, provider, code, 502, true)
    }
    catch (error: any) {
      // A thrown PaymentProviderError from the !retryable branch is final.
      if (error instanceof PaymentProviderError && !error.retryable) {
        throw error
      }
      lastError = error
      const aborted = error?.name === 'AbortError'
      log.warn('provider call errored', { provider, method, url, attempt, aborted, message: error?.message })
      if (attempt === maxAttempts) {
        break
      }
    }
    finally {
      clearTimeout(timer)
    }

    // Exponential backoff with full jitter — avoids a retry stampede when a
    // provider has a brief outage and every pending request wakes together.
    const backoff = Math.min(2 ** (attempt - 1) * 300, 4_000)
    await new Promise(resolve => setTimeout(resolve, Math.random() * backoff))
  }

  if (lastError instanceof PaymentProviderError) {
    throw lastError
  }
  throw new PaymentProviderError(
    `${provider} did not respond after ${maxAttempts} attempts`,
    req.provider,
    'network_error',
    504,
    true,
  )
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text)
  }
  catch {
    return { raw: text.slice(0, 500) }
  }
}

/** Each provider nests its error differently; normalise to {code, message}. */
function extractError(parsed: any, status: number): { code?: string, message: string } {
  // Stripe: { error: { code, message, type } }
  if (parsed?.error?.message) {
    return { code: parsed.error.code || parsed.error.type, message: parsed.error.message }
  }
  // GoCardless: { error: { message, errors: [{ message, reason }] } }
  if (parsed?.error?.errors?.length) {
    const first = parsed.error.errors[0]
    return { code: first.reason, message: first.message || parsed.error.message }
  }
  // PayPal: { name, message, details: [{ issue, description }] }
  if (parsed?.name && parsed?.message) {
    const detail = parsed.details?.[0]
    return { code: detail?.issue || parsed.name, message: detail?.description || parsed.message }
  }
  return { code: `http_${status}`, message: parsed?.raw || `Provider returned HTTP ${status}` }
}

/** Stripe's API is form-encoded and needs bracket notation for nesting. */
export function formEncode(data: Record<string, any>, prefix = ''): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) {
      continue
    }
    const field = prefix ? `${prefix}[${key}]` : key
    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(formEncode(value, field))
    }
    else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        parts.push(
          typeof item === 'object'
            ? formEncode(item, `${field}[${i}]`)
            : `${encodeURIComponent(`${field}[${i}]`)}=${encodeURIComponent(String(item))}`,
        )
      })
    }
    else {
      parts.push(`${encodeURIComponent(field)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.filter(Boolean).join('&')
}
