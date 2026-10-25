/**
 * Credit applications (Wallet.dc.html, 2026-10-25) — the answers the form
 * offers and the rules it checks, imported by the Wallet page and by
 * `POST /api/credit/application`, so the two cannot accept different things.
 */

export const BUSINESS_TYPES = [
  ['ltd', 'Limited company'],
  ['sole', 'Sole trader'],
  ['llp', 'Partnership'],
] as const
export type BusinessType = typeof BUSINESS_TYPES[number][0]

export const TURNOVER_BANDS = ['Under £50k', '£50k to £250k', '£250k to £1m', 'Over £1m'] as const

export const APPLICANT_ROLES = ['Director', 'Owner', 'Partner'] as const

/** The requested limit: from £2,500 in £500 steps, up to the ceiling setting. */
export const CREDIT_REQUEST_MIN = 2500
export const CREDIT_REQUEST_STEP = 500

/** `CL-1A2B3C`: a reference derived from the id, like `APX-` for orders. */
export function creditRef(id: string): string {
  return `CL-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

/**
 * A dd/mm/yyyy date of birth for someone aged 18 to 105 on `today`. Returns
 * the reason it is not, or '' when it is.
 */
export function dobProblem(value: string, today = new Date()): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!m) {
    return 'Use DD/MM/YYYY'
  }
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return 'That date does not exist'
  }
  const eighteen = new Date(y + 18, mo - 1, d)
  if (eighteen > today) {
    return 'You must be 18 or over'
  }
  if (today.getFullYear() - y > 105) {
    return 'Check the year'
  }
  return ''
}

/** A UK postcode, loosely: what a person types, not what Royal Mail validates. */
export function isPostcode(value: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(value.trim())
}
