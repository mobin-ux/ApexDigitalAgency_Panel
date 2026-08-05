import prisma from './prisma'
import { getSetting } from './settings'

/**
 * Apex Credit — the instant project-financing facility.
 *
 * Business model (2026 strategy): every customer has a credit line up to a
 * fixed ceiling (default £20,000) available IMMEDIATELY — no application, no
 * manager approval. Customers spend it directly on eligible projects and pick
 * their own repayment term (12-mo 0% or 24-mo — ADR-011) at checkout; the
 * project's Installment plan is the live repayment schedule.
 *
 * `used` is DERIVED from the outstanding principal of the customer's active
 * financed projects, never incrementally maintained, so it cannot drift out of
 * step with what has actually been repaid.
 */

export const DEFAULT_CREDIT_LIMIT = 20_000

/** The maximum credit limit, from Setting `credit.max-limit` (default £20,000). */
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
    where: { userId, status: { not: 'settled' } },
    select: {
      monthsTotal: true,
      monthsPaid: true,
      projectRef: { select: { amount: true } },
    },
  })

  let used = 0
  for (const plan of plans) {
    const principal = plan.projectRef?.amount ?? 0
    const remaining = plan.monthsTotal > 0
      ? Math.max(0, plan.monthsTotal - plan.monthsPaid) / plan.monthsTotal
      : 0
    used += principal * remaining
  }
  return Math.round(used * 100) / 100
}

export interface CreditSummary {
  limit: number
  used: number
  available: number
  status: string
  line: {
    id: string
    status: string
    limit: number
    used: number
    userId: string
  }
}

/**
 * Ensure the customer's credit facility exists and reflects the current limit
 * and derived usage, then return the summary. Idempotent — safe to call on
 * every dashboard load. FROZEN lines (an admin control) are left frozen.
 */
export async function ensureCredit(userId: string): Promise<CreditSummary> {
  const limit = await creditLimit()
  const used = await computeCreditUsed(userId)

  const existing = await prisma.creditLine.findUnique({ where: { userId } })
  const status = existing?.status === 'FROZEN' ? 'FROZEN' : 'ACTIVE'

  const line = await prisma.creditLine.upsert({
    where: { userId },
    create: {
      userId,
      status: 'ACTIVE',
      limit,
      used,
      requestedLimit: limit,
      approvedAt: new Date(),
    },
    update: { status, limit, used },
  })

  const available = Math.max(0, Math.round((limit - used) * 100) / 100)
  return {
    limit,
    used,
    available,
    status: line.status,
    line: { id: line.id, status: line.status, limit: line.limit, used: line.used, userId: line.userId },
  }
}
