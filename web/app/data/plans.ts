/**
 * Plan catalogues. The website instalment plans are one source for the
 * homepage explainer and the Website Design page; every catalogue here also
 * sets its service's "from" price, so a price can never differ between pages.
 *
 * Totals are always derived (`deposit + monthly × term`), never typed in.
 * TODO(content): the customer panel's order wizard prices plans from its own
 * admin catalogue, on 12 or 24 months with no deposit. These figures (and the
 * 6-month term) must be mirrored there before launch, or a visitor will see a
 * different price at checkout.
 */

import { formatGbp } from '../utils/format'

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

/**
 * Every other priced service sells one monthly figure per plan, billed one of
 * two ways: an ongoing retainer (SEO, PPC, marketing) or a deposit and a fixed
 * number of payments (UI/UX, branding). Prices are in pounds inc. VAT.
 *
 * TODO(content): the panel's order wizard does not sell these plans yet, so
 * their "Start your order" buttons open the contact form with the plan named.
 */
export type PlanBilling
  = | {
    kind: 'retainer'
    /** One-off set-up fee; 0 when there is none. */
    setupFee: number
    /** Months before the plan becomes rolling monthly. */
    minimumMonths: number
    /** Largest monthly ad budget the plan manages (PPC only). */
    adSpendCap?: number
  }
  | {
    kind: 'instalments'
    deposit: number
    /** Number of monthly payments after the deposit. */
    months: number
  }

export interface MonthlyPlan {
  id: string
  name: string
  monthly: number
  billing: PlanBilling
}

type PlanTrio = readonly [MonthlyPlan, MonthlyPlan, MonthlyPlan]

function retainer(setupFee: number, minimumMonths: number, adSpendCap?: number): PlanBilling {
  return { kind: 'retainer', setupFee, minimumMonths, adSpendCap }
}
function instalments(deposit: number, months: number): PlanBilling {
  return { kind: 'instalments', deposit, months }
}

export const seoPlans: PlanTrio = [
  { id: 'local', name: 'Local', monthly: 349, billing: retainer(0, 6) },
  { id: 'growth', name: 'Growth', monthly: 699, billing: retainer(0, 6) },
  { id: 'commerce', name: 'Commerce', monthly: 999, billing: retainer(0, 6) },
]

export const ppcPlans: PlanTrio = [
  { id: 'search', name: 'Search', monthly: 299, billing: retainer(199, 3, 1500) },
  { id: 'multi-channel', name: 'Multi-channel', monthly: 549, billing: retainer(299, 3, 5000) },
  { id: 'b2b', name: 'B2B', monthly: 749, billing: retainer(399, 3, 8000) },
]

export const marketingPlans: PlanTrio = [
  { id: 'essentials', name: 'Essentials', monthly: 399, billing: retainer(0, 3) },
  { id: 'growth', name: 'Growth', monthly: 899, billing: retainer(0, 3) },
  { id: 'partner', name: 'Partner', monthly: 1499, billing: retainer(0, 3) },
]

export const uxPlans: PlanTrio = [
  { id: 'review', name: 'Review', monthly: 249, billing: instalments(199, 6) },
  { id: 'redesign', name: 'Redesign', monthly: 499, billing: instalments(399, 6) },
  { id: 'product', name: 'Product', monthly: 899, billing: instalments(699, 6) },
]

export const brandPlans: PlanTrio = [
  { id: 'starter', name: 'Starter', monthly: 129, billing: instalments(149, 6) },
  { id: 'identity', name: 'Identity', monthly: 249, billing: instalments(249, 6) },
  { id: 'brand-web', name: 'Brand + Web', monthly: 239, billing: instalments(399, 12) },
]

/** What the plan costs in all, when it has an end; `null` for a rolling retainer. */
export function monthlyPlanTotal(plan: MonthlyPlan): number | null {
  return plan.billing.kind === 'instalments'
    ? plan.billing.deposit + plan.monthly * plan.billing.months
    : null
}

/**
 * The billing line on a plan card, written from the figures so it cannot
 * disagree with them: "£199 deposit, then 6 × £249", "No set-up fee ·
 * 6-month minimum", "Ad spend up to £1,500/mo · £199 set-up".
 */
export function billingNote(plan: MonthlyPlan): string {
  const { billing } = plan
  if (billing.kind === 'instalments') {
    return `${formatGbp(billing.deposit)} deposit, then ${billing.months} × ${formatGbp(plan.monthly)}`
  }
  const setup = billing.setupFee > 0 ? `${formatGbp(billing.setupFee)} set-up` : 'No set-up fee'
  return billing.adSpendCap
    ? `Ad spend up to ${formatGbp(billing.adSpendCap)}/mo · ${setup}`
    : `${setup} · ${billing.minimumMonths}-month minimum`
}

/** The lowest monthly figure in a catalogue: the "from" price. */
export function cheapestMonthly(plans: readonly MonthlyPlan[]): number {
  return Math.min(...plans.map(plan => plan.monthly))
}
