import { useRuntimeConfig } from '#imports'
import { createError } from 'h3'

/**
 * The two lending switches (ADR-025). Both default to off and are set only in
 * the environment (`runtimeConfig.lending`), so turning on something that may
 * make the company a regulated lender is a deliberate deployment decision by
 * the owner, not a click in the admin console.
 */

export function lendingFlags(): { interestBearingPlans: boolean, creditDecisions: boolean } {
  const lending = useRuntimeConfig().lending ?? {}
  return {
    // Env overrides arrive as strings; anything but true stays off.
    interestBearingPlans: String(lending.interestBearingPlans) === 'true',
    creditDecisions: String(lending.creditDecisions) === 'true',
  }
}

/** Refuse a credit decision that grants or widens credit while the switch is off. */
export function requireCreditDecisions(): void {
  if (!lendingFlags().creditDecisions) {
    throw createError({
      statusCode: 409,
      message: 'Approving credit is switched off until the owner confirms it (NUXT_LENDING_CREDIT_DECISIONS). You can still decline, freeze or lower a line.',
      data: { flag: 'NUXT_LENDING_CREDIT_DECISIONS' },
    })
  }
}

/** Refuse to create an interest-bearing plan while the switch is off. */
export function requireInterestBearingPlans(): void {
  if (!lendingFlags().interestBearingPlans) {
    throw createError({
      statusCode: 409,
      message: 'Interest-bearing plans are switched off (NUXT_LENDING_INTEREST_BEARING_PLANS).',
      data: { flag: 'NUXT_LENDING_INTEREST_BEARING_PLANS' },
    })
  }
}
