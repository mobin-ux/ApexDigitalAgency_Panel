/**
 * Money handling — minor units (pence) are the only safe representation.
 *
 * The legacy schema stores pounds as `Float` (Transaction.amount,
 * User.walletBalance, Installment totals). Floats cannot represent £225.95
 * exactly; across 24 installment charges plus a provider reconciliation diff
 * that error is real money. Everything on the payment rails (ADR-015) uses
 * integer pence, and conversion happens explicitly at this boundary —
 * never implicitly, never with bare `* 100`.
 */

/** ISO 4217 codes we support, with their minor-unit exponent. */
const EXPONENTS: Record<string, number> = {
  GBP: 2,
  EUR: 2,
  USD: 2,
}

export function exponentFor(currency: string): number {
  const exp = EXPONENTS[currency.toUpperCase()]
  if (exp === undefined) {
    throw new Error(`Unsupported currency: ${currency}`)
  }
  return exp
}

/**
 * Pounds (Float, legacy columns / user input) → pence (Int).
 * Rounds half-up on the minor unit, which is what invoicing expects.
 */
export function toMinor(amount: number, currency = 'GBP'): number {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`toMinor received a non-finite amount: ${amount}`)
  }
  const factor = 10 ** exponentFor(currency)
  // The epsilon nudge defeats binary representations that land a hair below
  // the .5 boundary (e.g. 1.005 stored as 1.00499999999999989).
  return Math.round((amount + Number.EPSILON * Math.sign(amount)) * factor)
}

/** Pence (Int) → pounds (Float) for the legacy columns and the UI. */
export function toMajor(minor: number, currency = 'GBP'): number {
  return minor / 10 ** exponentFor(currency)
}

/** Display helper for server-side strings (emails, ledger descriptions). */
export function formatMinor(minor: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(toMajor(minor, currency))
}

/**
 * Split a total into `parts` whole minor units that sum back EXACTLY to the
 * total — the remainder is spread one penny at a time across the earliest
 * parts. This is how installment schedules avoid a rounding shortfall on the
 * final charge.
 */
export function allocate(total: number, parts: number): number[] {
  if (parts <= 0) {
    throw new RangeError('allocate() needs at least one part')
  }
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}

/** Guard for amounts arriving from the wire: positive, integral, sane bound. */
export function assertValidMinor(minor: number, label = 'amount'): number {
  if (!Number.isInteger(minor) || minor <= 0) {
    throw new TypeError(`${label} must be a positive integer in minor units, got ${minor}`)
  }
  if (minor > 100_000_000_00) {
    throw new RangeError(`${label} exceeds the £100,000,000 ceiling`)
  }
  return minor
}
