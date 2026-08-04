import { z } from 'zod'

/**
 * Login identifier handling — a customer may register and sign in with either
 * an email address OR a mobile phone number. Parsing and normalisation live in
 * one place so signup and login always agree on what a given input maps to;
 * otherwise a number stored one way at signup could never be matched at login.
 */

export type ParsedIdentifier
  = | { kind: 'email', email: string }
    | { kind: 'phone', phone: string }

const emailSchema = z.string().email()

/**
 * Normalise a phone number to a comparable canonical form: an optional leading
 * `+` (country prefix) followed by digits only. Punctuation, spaces and
 * brackets are stripped. Deliberately does NOT infer a country code — whatever
 * the user typed at signup is what they type at login, so consistency matters
 * more than E.164 perfection here.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

/**
 * Classify a raw identifier as an email or a phone number, or return null when
 * it is neither. The `@` heuristic is the standard split: anything with an `@`
 * is treated as an email (and validated as one), everything else as a phone.
 */
export function parseIdentifier(raw: string): ParsedIdentifier | null {
  const value = raw.trim()
  if (!value) {
    return null
  }

  if (value.includes('@')) {
    const email = value.toLowerCase()
    return emailSchema.safeParse(email).success ? { kind: 'email', email } : null
  }

  const phone = normalizePhone(value)
  const digits = phone.replace(/\D/g, '')
  // 7–15 digits covers national and international mobile numbers (E.164 caps at 15).
  if (digits.length >= 7 && digits.length <= 15) {
    return { kind: 'phone', phone }
  }
  return null
}

/** Prisma `where` clause that finds a user by whichever identifier they used. */
export function identifierWhere(parsed: ParsedIdentifier): { email: string } | { phone: string } {
  return parsed.kind === 'email' ? { email: parsed.email } : { phone: parsed.phone }
}
