/**
 * Deterministic formatters. The locale and time zone are fixed so the server
 * render and the browser hydration always produce the same string.
 */

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** 2087 → "£2,087". Whole pounds only; the site never quotes pence. */
export function formatGbp(amount: number): string {
  return gbp.format(amount)
}

/** "2026-03-01" → "March 2026". */
export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(iso))
}

/** "2026-09-14" → "14 September 2026". */
export function formatDate(iso: string): string {
  return dayMonthYear.format(new Date(iso))
}
