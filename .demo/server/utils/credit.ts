import prisma from './prisma'
import { getSetting } from './settings'

/**
 * Apex Credit — how much a customer may have in open instalment plans at once.
 *
 * Since 2026-10-25 (Wallet.dc.html) a credit line is applied for and approved
 * by staff (`CreditApplication`, /admin/credit); before that every account was
 * given one automatically. Lines that already existed were kept as they were.
 * Without a line a customer can still run one fixed monthly plan at a time —
 * see `creditAllows()`.
 *
 * `used` is DERIVED from what is still owed on the customer's financed plans,
 * never incrementally maintained, so it cannot drift out of step with what has
 * actually been paid.
 */

export const DEFAULT_CREDIT_LIMIT = 20_000

/**
 * The most staff may approve for one client, and the top of the amount a
 * customer can ask for — Setting `credit.max-limit` (default £20,000).
 */
export function creditLimit(): Promise<number> {
  return getSetting<number>('credit.max-limit', DEFAULT_CREDIT_LIMIT)
}

/**
 * Outstanding credit = remaining principal across the customer's active
 * financed projects. For each unsettled plan the remaining principal is the
 * project amount scaled by the fraction of the term still unpaid, so a 24-month
 * plan's interest is excluded (only principal counts against the limit).
 */
export async function computeCreditUsed(userId: string): Promise<number> {
  const plans = await prisma.installment.findMany({
    // Retainers are a subscription, not a balance owed: they never draw credit.
    where: { userId, status: { not: 'settled' }, kind: { not: 'retainer' } },
    select: {
      monthsTotal: true,
      monthsPaid: true,
      total: true,
      paid: true,
      projectRef: { select: { amount: true, serviceId: true } },
    },
  })

  let used = 0
  for (const plan of plans) {
    // Panel v2 plans are interest-free and exclude any deposit, so what is
    // still owed is exactly the unpaid part of the plan (ADR-019).
    if (plan.projectRef?.serviceId) {
      used += Math.max(0, plan.total - plan.paid)
      continue
    }
    const principal = plan.projectRef?.amount ?? 0
    const remaining = plan.monthsTotal > 0
      ? Math.max(0, plan.monthsTotal - plan.monthsPaid) / plan.monthsTotal
      : 0
    used += principal * remaining
  }
  return Math.round(used * 100) / 100
}

/** none: no line and nothing under review · review: an application is waiting · approved · frozen (on hold). */
export type CreditState = 'none' | 'review' | 'approved' | 'frozen'

export interface CreditSummary {
  state: CreditState
  /** ACTIVE or FROZEN for a line; NONE without one. */
  status: string
  limit: number
  used: number
  available: number
  /** The application waiting for a decision, else the most recent decided one. */
  application: { id: string, status: string, requestedLimit: number, submittedAt: Date, decidedAt: Date | null } | null
}

/**
 * Read the customer's credit position, refreshing the line's derived `used`.
 * Idempotent and safe on every page load. It never creates a line: only an
 * approved application does (and a FROZEN line stays frozen).
 */
export async function ensureCredit(userId: string): Promise<CreditSummary> {
  const [used, line, application] = await Promise.all([
    computeCreditUsed(userId),
    prisma.creditLine.findUnique({ where: { userId } }),
    prisma.creditApplication.findFirst({
      where: { userId, status: { in: ['SUBMITTED', 'APPROVED', 'DECLINED'] } },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, status: true, requestedLimit: true, submittedAt: true, decidedAt: true },
    }),
  ])

  // A line from before applications may be PENDING or REJECTED (the old
  // apply flow); only an ACTIVE or FROZEN line with a limit is credit.
  const hasLine = Boolean(line && (line.status === 'ACTIVE' || line.status === 'FROZEN') && line.limit > 0)
  if (line && line.used !== used) {
    await prisma.creditLine.update({ where: { userId }, data: { used } })
  }

  const limit = hasLine ? line!.limit : 0
  const state: CreditState = hasLine
    ? (line!.status === 'FROZEN' ? 'frozen' : 'approved')
    : application?.status === 'SUBMITTED' ? 'review' : 'none'

  return {
    state,
    status: hasLine ? line!.status : 'NONE',
    limit,
    used,
    available: Math.max(0, Math.round((limit - used) * 100) / 100),
    application,
  }
}

/**
 * Whether a new plan financing `financed` may be signed. Without a line, or
 * with nothing yet in use, one plan is always allowed (the design's "one at a
 * time"); after that the line's available amount decides. Returns the reason
 * when it may not.
 */
export function creditAllows(credit: CreditSummary, financed: number): string | null {
  if (financed <= 0 || credit.used <= 0) {
    return null
  }
  if (credit.state === 'approved' && financed <= credit.available) {
    return null
  }
  const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`
  return credit.state === 'approved'
    ? `The monthly payments (${gbp(financed)}) are more than your available Apex credit of ${gbp(credit.available)}. Choose to pay in full, or finish an existing plan first.`
    : 'You already have a monthly plan running. Apply for a credit line in your Wallet to run more than one at once, or choose to pay in full.'
}
