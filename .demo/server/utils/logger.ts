import process from 'node:process'

/**
 * Structured logging for the server side.
 *
 * Payment code logs a lot and payment logs are exactly where PANs, CVVs and
 * API secrets leak in real incidents. `redact()` is defence in depth: card
 * data should never reach us at all (PCI SAQ-A, ADR-015 §8), but if a
 * provider ever echoes something sensitive in an error body, it must not
 * land in a log aggregator.
 *
 * Output is one JSON object per line in production (parseable by any log
 * pipeline) and a readable line in dev.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (import.meta.dev ? 'debug' : 'info')

/** Keys whose values are replaced wholesale, whatever they contain. */
const SECRET_KEYS = /^(?:password|secret|token|authorization|api[_-]?key|client[_-]?secret|signature|cvc|cvv|card[_-]?number|pan|iban|account[_-]?number|sort[_-]?code)$/i

/** 13–19 digits with optional spaces/dashes — a card number shape. */
const PAN_LIKE = /\b(?:\d[ -]?){13,19}\b/g

function redactString(value: string): string {
  return value.replace(PAN_LIKE, (match) => {
    const digits = match.replace(/\D/g, '')
    // Luhn check keeps ordinary long numbers (ids, timestamps) readable.
    return luhn(digits) ? `[redacted-pan:${digits.slice(-4)}]` : match
  })
}

function luhn(digits: string): boolean {
  if (digits.length < 13) {
    return false
  }
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) {
        d -= 9
      }
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[depth-limit]'
  }
  if (typeof input === 'string') {
    return redactString(input)
  }
  if (Array.isArray(input)) {
    return input.map(v => redact(v, depth + 1))
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? '[redacted]' : redact(value, depth + 1)
    }
    return out
  }
  return input
}

function emit(level: LogLevel, scope: string, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) {
    return
  }
  const safe = context ? (redact(context) as Record<string, unknown>) : undefined
  if (import.meta.dev) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${scope}] ${message}`, safe ?? '')
    return
  }
  const line = JSON.stringify({ ts: new Date().toISOString(), level, scope, message, ...safe })
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line)
}

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
  child: (childScope: string) => Logger
}

/** `const log = createLogger('payments:stripe')` */
export function createLogger(scope: string): Logger {
  return {
    debug: (m, c) => emit('debug', scope, m, c),
    info: (m, c) => emit('info', scope, m, c),
    warn: (m, c) => emit('warn', scope, m, c),
    error: (m, c) => emit('error', scope, m, c),
    child: (childScope: string) => createLogger(`${scope}:${childScope}`),
  }
}
