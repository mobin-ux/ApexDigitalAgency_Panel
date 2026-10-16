/**
 * The website instalment plans: one source for the homepage explainer and the
 * Website Design page, so a price can never differ between the two.
 *
 * Totals are always derived (`deposit + monthly × term`), never typed in.
 * TODO(content): the customer panel's order wizard prices plans from its own
 * admin catalogue, on 12 or 24 months with no deposit. These figures (and the
 * 6-month term) must be mirrored there before launch, or a visitor will see a
 * different price at checkout.
 */

export type PlanId = 'starter' | 'growth' | 'complete'
export type PlanTerm = 12 | 6

export interface InstalmentPlan {
  id: PlanId
  name: string
  /** Deposit due before work starts, in pounds inc. VAT. */
  deposit: number
  /** Monthly payment for each term, in pounds inc. VAT. */
  monthly: Record<PlanTerm, number>
}

export const planTerms: readonly PlanTerm[] = [12, 6]
export const defaultPlanTerm: PlanTerm = 12

export const websitePlans: readonly [InstalmentPlan, InstalmentPlan, InstalmentPlan] = [
  { id: 'starter', name: 'Starter', deposit: 299, monthly: { 12: 149, 6: 279 } },
  { id: 'growth', name: 'Growth', deposit: 499, monthly: { 12: 299, 6: 559 } },
  { id: 'complete', name: 'Complete', deposit: 799, monthly: { 12: 499, 6: 929 } },
]

export function planTotal(plan: InstalmentPlan, term: PlanTerm): number {
  return plan.deposit + plan.monthly[term] * term
}

/** The most any plan saves by paying over the shorter term. */
export function maxShortTermSaving(): number {
  return Math.max(...websitePlans.map(plan => planTotal(plan, 12) - planTotal(plan, 6)))
}
