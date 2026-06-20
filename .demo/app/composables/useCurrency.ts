/**
 * Centralised money formatting for the Apex Digi dashboard.
 *
 * Apex Digi is a UK agency, so everything defaults to GBP (£).
 * Use this everywhere instead of hand-rolled `Intl.NumberFormat` calls so
 * the currency, locale and rounding stay consistent across every page.
 *
 * @example
 * const { formatCurrency } = useCurrency()
 * formatCurrency(1499)        // "£1,499"
 * formatCurrency(1499.5, { maximumFractionDigits: 2 }) // "£1,499.50"
 */
export interface CurrencyOptions {
  /** ISO 4217 currency code. Defaults to GBP. */
  currency?: string
  /** BCP 47 locale. Defaults to en-GB. */
  locale?: string
  /** Minimum fraction digits. Defaults to 0. */
  minimumFractionDigits?: number
  /** Maximum fraction digits. Defaults to 0. */
  maximumFractionDigits?: number
}

const DEFAULTS = {
  currency: 'GBP',
  locale: 'en-GB',
} as const

export function useCurrency() {
  function formatCurrency(value: number | null | undefined, options: CurrencyOptions = {}) {
    const amount = Number.isFinite(value as number) ? (value as number) : 0
    const {
      currency = DEFAULTS.currency,
      locale = DEFAULTS.locale,
      minimumFractionDigits = 0,
      maximumFractionDigits = 0,
    } = options

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount)
  }

  /** Format a plain number with thousands separators (no currency symbol). */
  function formatNumber(value: number | null | undefined, options: CurrencyOptions = {}) {
    const amount = Number.isFinite(value as number) ? (value as number) : 0
    const { locale = DEFAULTS.locale, maximumFractionDigits = 0 } = options
    return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(amount)
  }

  return {
    formatCurrency,
    formatNumber,
    currencyCode: DEFAULTS.currency,
    currencySymbol: '£',
  }
}
