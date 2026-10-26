import { Buffer } from 'node:buffer'
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto'
import { createError } from 'h3'
import { safeEqual } from './crypto'

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226): HMAC-SHA1, six
 * digits, 30-second steps — the defaults every authenticator app assumes, so
 * the otpauth URI needs nothing unusual. No dependency: it is forty lines of
 * `node:crypto`, and a library here would be one more thing holding secrets.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PERIOD = 30
const DIGITS = 6

function toBase32(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31]
  }
  return out
}

function fromBase32(text: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of text.replace(/[\s=]/g, '').toUpperCase()) {
    const idx = ALPHABET.indexOf(ch)
    if (idx === -1) {
      throw createError({ statusCode: 500, message: 'Stored two-step secret is not valid base32' })
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A new 160-bit secret, base32 as the apps expect it. */
export function newTotpSecret(): string {
  return toBase32(randomBytes(20))
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / PERIOD)
}

/** The code for one step. Exported for tests and the dev check, nothing else. */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', fromBase32(secret)).update(counter).digest()
  const offset = mac[mac.length - 1]! & 0x0F
  const binary = ((mac[offset]! & 0x7F) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0')
}

/**
 * The step `input` is the code for — one step either side of now, for clock
 * drift — or null. Never a step at or before `lastStep`, so a code that has
 * been used (or a code from before it) cannot be replayed.
 */
export function matchTotp(secret: string, input: string, lastStep: number | null): number | null {
  const code = input.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) {
    return null
  }
  const now = currentStep()
  for (const step of [now - 1, now, now + 1]) {
    if (step > (lastStep ?? -1) && safeEqual(totpCode(secret, step), code)) {
      return step
    }
  }
  return null
}

/** What the QR code holds; the label is how the app lists the account. */
export function otpauthUri(secret: string, label: string): string {
  const issuer = 'Apex Digi'
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${label}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`
}

/* ------------------------------------------------------------ backup codes */

// No 0/o, 1/l/i: the codes get copied by hand off paper.
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'

function normaliseBackup(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(normaliseBackup(code)).digest('hex')
}

/** Ten single-use codes, shown once; only their hashes are stored. */
export function newBackupCodes(): { codes: string[], hashes: string[] } {
  const codes = Array.from({ length: 10 }, () => {
    const raw = Array.from({ length: 10 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
  return { codes, hashes: codes.map(hashBackupCode) }
}

/** The hashes left after using `input`, or null when it is not one of them. */
export function useBackupCode(hashes: string[], input: string): string[] | null {
  if (normaliseBackup(input).length !== 10) {
    return null
  }
  const hash = hashBackupCode(input)
  const hit = hashes.find(h => safeEqual(h, hash))
  return hit ? hashes.filter(h => h !== hit) : null
}
