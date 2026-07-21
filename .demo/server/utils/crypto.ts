import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { createLogger } from './logger'

/**
 * Application-level encryption for sensitive fields at rest.
 *
 * Scope, stated plainly: this protects data if the SQLite file or a database
 * backup leaks. It does NOT protect against an attacker with code execution
 * on the server, who can read the key. That is the honest boundary of
 * application-level field encryption everywhere; the mitigation is a KMS
 * (AWS KMS / GCP KMS / Vault) holding the key, which `getKey()` is shaped to
 * accommodate without touching call sites.
 *
 * AES-256-GCM: authenticated, so tampering is detected rather than silently
 * decrypting to garbage. Format: v1.<iv>.<authTag>.<ciphertext>, all base64url.
 *
 * NOT used for card data — that never reaches us at all (PCI SAQ-A,
 * ADR-015 §8). Intended for bank account details, tax references and
 * similar PII that the business genuinely needs to store.
 */

const log = createLogger('crypto')
const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

let cachedKey: Buffer | null = null

/**
 * Derive the 32-byte data key. Swap this function's body for a KMS fetch to
 * move key custody out of the environment; nothing else changes.
 */
function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey
  }

  const material = process.env.NUXT_ENCRYPTION_KEY || process.env.NUXT_JWT_SECRET

  if (!material) {
    throw new Error(
      'No encryption key available. Set NUXT_ENCRYPTION_KEY (32+ random bytes, e.g. `openssl rand -hex 32`).',
    )
  }

  if (material === process.env.NUXT_JWT_SECRET && !import.meta.dev) {
    // Reusing the signing secret for encryption is a real weakness: one
    // leaked value compromises both sessions and stored data.
    log.warn('NUXT_ENCRYPTION_KEY is unset — falling back to the JWT secret. Set a dedicated key in production.')
  }

  // scrypt stretches whatever the operator supplied into a proper 32-byte
  // key, so a short passphrase does not become a short key. The salt is
  // fixed by design: the same input must derive the same key across restarts
  // or existing ciphertext becomes unreadable.
  cachedKey = scryptSync(material, 'apex-field-encryption-v1', 32)
  return cachedKey
}

/** Encrypt a UTF-8 string. Returns the self-describing envelope. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12) // 96-bit nonce, the GCM standard
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

/**
 * Decrypt an envelope produced by `encryptField`. Throws on tampering or a
 * wrong key — callers should treat a throw as "this data is unusable",
 * never as "return the raw value".
 */
export function decryptField(envelope: string): string {
  const parts = envelope.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed ciphertext envelope')
  }

  const [, ivB64, tagB64, dataB64] = parts
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64!, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64!, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/** True when a stored value is one of our envelopes (for gradual migration). */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`) && value.split('.').length === 4
}

/** Decrypt if encrypted, pass through otherwise. Eases rollout on existing rows. */
export function decryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  return isEncrypted(value) ? decryptField(value) : value
}

/**
 * Deterministic, non-reversible fingerprint — for equality lookups on data
 * that is stored encrypted (encryption is randomised, so ciphertext cannot
 * be compared). Keyed so it cannot be brute-forced from a stolen column
 * alone the way a bare SHA-256 of a sort code could be.
 */
export function blindIndex(value: string): string {
  return createHash('sha256')
    .update(getKey())
    .update(value.trim().toLowerCase())
    .digest('base64url')
}

/** Constant-time string comparison for tokens and secrets. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

/** URL-safe random token (password reset, API keys, idempotency anchors). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Test seam — the key is cached per process. */
export function resetKeyCache(): void {
  cachedKey = null
}
