/**
 * What a log line may never carry, decided once for both apps (the panel
 * re-exports this file by relative path, like `shared/visits.ts`).
 *
 * The loggers pass every context object through `redact()` before it is
 * written. Callers are still expected to log ids and outcomes rather than
 * personal data; this is the backstop for the field nobody thought about,
 * and for free text (an error message, a provider's error body) that may
 * quote a value back.
 *
 * - Secrets (passwords, tokens, signatures, codes, keys, card and bank
 *   numbers) are replaced wholesale, whatever they hold.
 * - Personal data with a known key is masked: an email keeps its first
 *   character and its domain, a phone number its last two digits, an
 *   address, postcode or date of birth only its length.
 * - Message bodies (`content`, `message` under a body-like key) keep only
 *   their length.
 * - Inside any string: card numbers that pass the Luhn check, JWTs, bearer
 *   tokens and email addresses are masked.
 */

/** Keys whose values are replaced wholesale. Compared lower-case without `_` or `-`. */
const SECRET_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'secret',
  'clientsecret',
  'webhooksecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'ticket',
  'authorization',
  'cookie',
  'setcookie',
  'apikey',
  'privatekey',
  'secretkey',
  'signature',
  'otp',
  'totp',
  'backupcode',
  'backupcodes',
  'recoverycodes',
  'cvc',
  'cvv',
  'cardnumber',
  'pan',
  'iban',
  'accountnumber',
  'sortcode',
  'encryptionkey',
  'jwt',
])

/** Personal data masked to a shape. */
const EMAIL_KEYS = new Set(['email', 'actoremail', 'to', 'from', 'replyto', 'identifier'])
const PHONE_KEYS = new Set(['phone', 'mobile', 'telephone', 'tel'])
const LENGTH_ONLY_KEYS = new Set([
  'address',
  'addressline1',
  'addressline2',
  'street',
  'postcode',
  'dob',
  'dateofbirth',
  'birthday',
  'birthdate',
  'content',
  'body',
  'bio',
  'notes',
  'note',
  'brief',
  'ratingnote',
])

const PAN_LIKE = /\b(?:\d[ -]?){13,19}\b/g
const JWT_LIKE = /\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}\b/g
const BEARER = /\bBearer\s+[\w.~+/-]+=*/gi
const EMAIL_IN_TEXT = /\b[\w.%+-]+@([\w-]+(?:\.[\w-]+)+)\b/g
/** A six-to-eight digit code under a `code` key is a one-time code; anything else under it is an error code. */
const ONE_TIME_CODE = /^\s*\d{6,8}\s*$/

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

export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@')
  if (at < 1) {
    return '[redacted]'
  }
  return `${value[0]}***@${value.slice(at + 1)}`
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length < 4 ? '[redacted]' : `***${digits.slice(-2)}`
}

/** Masks secrets and addresses that appear inside free text. */
export function redactString(value: string): string {
  return value
    .replace(JWT_LIKE, '[redacted-jwt]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(EMAIL_IN_TEXT, (match: string, domain: string) => `${match[0]}***@${domain}`)
    .replace(PAN_LIKE, (match) => {
      const digits = match.replace(/\D/g, '')
      // Luhn keeps ordinary long numbers (ids, timestamps) readable.
      return luhn(digits) ? `[redacted-pan:${digits.slice(-4)}]` : match
    })
}

function normalise(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '')
}

function redactKeyed(key: string, value: unknown, depth: number): unknown {
  const k = normalise(key)
  if (SECRET_KEYS.has(k)) {
    return value === null || value === undefined || value === '' ? value : '[redacted]'
  }
  if (k === 'code' && typeof value === 'string' && ONE_TIME_CODE.test(value)) {
    return '[redacted]'
  }
  if (typeof value === 'string') {
    if (EMAIL_KEYS.has(k) && value.includes('@')) {
      return maskEmail(value)
    }
    if (PHONE_KEYS.has(k) || k === 'identifier') {
      return maskPhone(value)
    }
    if (LENGTH_ONLY_KEYS.has(k)) {
      return `[redacted:${value.length} chars]`
    }
  }
  return redact(value, depth + 1)
}

/** A copy of `input` safe to write to a log. Never mutates the input. */
export function redact(input: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[depth-limit]'
  }
  if (typeof input === 'string') {
    return redactString(input)
  }
  if (Array.isArray(input)) {
    return input.slice(0, 50).map(v => redact(v, depth + 1))
  }
  if (input instanceof Date) {
    return input.toISOString()
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = redactKeyed(key, value, depth)
    }
    return out
  }
  return input
}

/**
 * The client address as a log may keep it: an IPv4 address with its last
 * octet zeroed, an IPv6 address cut to its /48. Enough to see that a burst
 * came from one network, not enough to name a household.
 */
export function maskIp(ip: string | undefined | null): string | undefined {
  if (!ip) {
    return undefined
  }
  if (ip === '::1' || ip.startsWith('127.') || ip === '::ffff:127.0.0.1') {
    return 'loopback'
  }
  const v4 = ip.replace(/^::ffff:/, '')
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v4)) {
    return v4.replace(/\.\d{1,3}$/, '.0')
  }
  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 3).join(':')}::/48`
  }
  return undefined
}
