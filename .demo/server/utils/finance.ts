import { createError } from 'h3'
import { firstPaymentDate } from '../../shared/catalog'
import prisma from './prisma'

/**
 * Financing engine — the single server-side source of the locked ADR-011
 * math and of installment charging. Both customer endpoints and admin
 * actions (and lazy auto-pay) go through `chargeInstallment` so the
 * money rules exist exactly once.
 */

export interface FinancingPlan {
  termMonths: number
  /** Monthly rate: 0 for the 12-month plan, 0.01 for the 24-month plan. */
  interestRate: number
  monthlyAmount: number
  totalAmount: number
}

/**
 * ADR-011 (locked): 12-mo = 0% interest, base/12.
 * 24-mo = 1%/month on the reducing balance, amortized:
 * monthly = base·0.01 / (1 − 1.01⁻²⁴).
 */
export function planFor(base: number, termMonths: 12 | 24): FinancingPlan {
  if (termMonths === 12) {
    const monthly = base / 12
    return { termMonths, interestRate: 0, monthlyAmount: monthly, totalAmount: base }
  }
  const r = 0.01
  const monthly = base * r / (1 - (1 + r) ** -24)
  return { termMonths, interestRate: r, monthlyAmount: monthly, totalAmount: monthly * 24 }
}

/** Icon shown next to a plan, keyed off the project category. */
export function planIcon(category: string): string {
  const c = (category || '').toLowerCase()
  if (c.includes('seo')) {
    return 'lucide:bar-chart-3'
  }
  if (c.includes('market')) {
    return 'lucide:megaphone'
  }
  if (c.includes('brand') || c.includes('design')) {
    return 'lucide:pen-tool'
  }
  return 'lucide:monitor'
}

export interface ChargeResult {
  ok: boolean
  /** Machine-readable failure reason when !ok. */
  reason?: 'not_found' | 'settled' | 'insufficient_funds' | 'not_started'
  charged?: number
  settled?: boolean
}

/**
 * Charge ONE monthly installment from the owner's wallet.
 * Atomic: the balance check and debit are a single conditional update
 * (same no-double-spend pattern as /api/orders/pay), and plan counters,
 * ledger row and settlement all commit together or not at all.
 *
 * `actor` is recorded in the ledger description when an admin triggers
 * the charge on the customer's behalf.
 */
export async function chargeInstallment(planId: string, opts?: { actorNote?: string }): Promise<ChargeResult> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.installment.findUnique({
      where: { id: planId },
      include: { projectRef: { select: { id: true, name: true, category: true } } },
    })
    if (!plan) {
      return { ok: false, reason: 'not_found' as const }
    }
    // A v2 plan is `pending` until its project's kickoff payment is collected
    // (ADR-019): no monthly payment may be taken before the deposit.
    if (plan.status === 'pending') {
      return { ok: false, reason: 'not_started' as const }
    }
    // A retainer runs past its minimum term until cancelled, so only a fixed
    // plan can run out of payments.
    const retainer = plan.kind === 'retainer'
    if (plan.status === 'settled' || (!retainer && plan.monthsPaid >= plan.monthsTotal)) {
      return { ok: false, reason: 'settled' as const }
    }

    // Final installment absorbs float rounding so paid lands exactly on total.
    const remaining = retainer ? Number.POSITIVE_INFINITY : Math.max(0, plan.total - plan.paid)
    const amount = Math.round(Math.min(plan.monthlyAmount || plan.amountDue, remaining) * 100) / 100
    if (amount <= 0) {
      return { ok: false, reason: 'settled' as const }
    }

    const debited = await tx.user.updateMany({
      where: { id: plan.userId, walletBalance: { gte: amount } },
      data: { walletBalance: { decrement: amount } },
    })
    if (debited.count === 0) {
      return { ok: false, reason: 'insufficient_funds' as const }
    }

    const monthsPaid = plan.monthsPaid + 1
    const settled = !retainer && monthsPaid >= plan.monthsTotal
    const nextDue = new Date(plan.nextDue)
    nextDue.setMonth(nextDue.getMonth() + 1)

    await tx.installment.update({
      where: { id: plan.id },
      data: {
        paid: Math.round((plan.paid + amount) * 100) / 100,
        // A retainer's "total" is what it has committed to so far.
        ...(retainer ? { total: Math.max(plan.total, Math.round((plan.paid + amount) * 100) / 100) } : {}),
        monthsPaid,
        amountDue: settled ? 0 : plan.monthlyAmount,
        nextDue,
        status: settled ? 'settled' : 'active',
      },
    })

    // When the repayment plan settles, the linked contract is fulfilled.
    if (settled && plan.projectId) {
      await tx.contract.updateMany({
        where: { projectId: plan.projectId, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        data: { status: 'COMPLETED' },
      })
    }

    const projectName = plan.projectRef?.name ?? plan.project
    await tx.transaction.create({
      data: {
        userId: plan.userId,
        amount: -amount,
        type: 'PAYMENT',
        category: plan.projectRef?.category ?? null,
        installmentId: plan.id,
        projectId: plan.projectId,
        // A retainer's first month is taken at kickoff, so this is month n + 1.
        description: retainer
          ? `Month ${monthsPaid + 1} — ${projectName}${opts?.actorNote ? ` (${opts.actorNote})` : ''}`
          : `Installment ${monthsPaid}/${plan.monthsTotal} — ${projectName}${opts?.actorNote ? ` (${opts.actorNote})` : ''}`,
      },
    })

    await tx.notification.create({
      data: {
        userId: plan.userId,
        title: settled ? 'Payment plan settled 🎉' : 'Installment paid',
        message: settled
          ? `Final installment of ${amount.toFixed(2)} for ${projectName} received — the plan is fully paid.`
          : `Installment ${monthsPaid} of ${plan.monthsTotal} (${amount.toFixed(2)}) for ${projectName} was paid.`,
        type: 'SUCCESS',
        link: '/dashboards/wallet',
      },
    })

    return { ok: true, charged: amount, settled }
  })
}

/**
 * Lazy auto-pay: charge every due plan of a user whose wallet covers it.
 * Called from finance-dashboard load (no cron in this stack — documented
 * in ADR-014). Stops on first insufficient-funds per plan but continues
 * with other plans.
 */
export async function runAutoPay(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { autoPayInstallments: true } })
  if (!user?.autoPayInstallments) {
    return 0
  }
  const due = await prisma.installment.findMany({
    where: { userId, status: 'active', nextDue: { lte: new Date() } },
    select: { id: true },
  })
  let paid = 0
  for (const plan of due) {
    const result = await chargeInstallment(plan.id, { actorNote: 'auto-pay' })
    if (result.ok) {
      paid += 1
    }
  }
  return paid
}

export function validationErrorFromCharge(reason: NonNullable<ChargeResult['reason']>): never {
  if (reason === 'not_found') {
    throw createError({ statusCode: 404, message: 'Installment plan not found' })
  }
  if (reason === 'settled') {
    throw createError({ statusCode: 400, message: 'This plan is already fully paid.' })
  }
  if (reason === 'not_started') {
    throw createError({ statusCode: 400, message: 'Monthly payments start after the kickoff payment.' })
  }
  throw createError({ statusCode: 400, message: 'Insufficient wallet balance. Please top up first.' })
}

export type KickoffResult
  = | { ok: true, charged: number }
    | { ok: false, reason: 'not_found' | 'already_paid' | 'insufficient_funds', shortBy?: number }

class KickoffShortfall extends Error {
  constructor(public shortBy: number) {
    super('Wallet balance does not cover the kickoff payment')
  }
}

/**
 * Collect a Panel v2 project's kickoff payment from the wallet and start the
 * work (ADR-019): deposit, payment in full, set-up plus first month, or the
 * discovery fee — whatever `orderTerms()` priced at order time and stored on
 * `Project.kickoffAmount`. The debit, the ledger row, the project status and
 * the plan's first real due date commit together or not at all, and a
 * conditional update on `kickoffPaidAt` means two clicks charge once.
 */
export async function collectKickoff(projectId: string, opts?: { actorNote?: string }): Promise<KickoffResult> {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { installmentPlan: true, milestones: { orderBy: { date: { sort: 'asc', nulls: 'last' } } } },
    })
    if (!project) {
      return { ok: false as const, reason: 'not_found' as const }
    }
    const claimed = await tx.project.updateMany({
      where: { id: projectId, kickoffPaidAt: null },
      data: { kickoffPaidAt: new Date() },
    })
    if (claimed.count === 0) {
      return { ok: false as const, reason: 'already_paid' as const }
    }

    const amount = Math.round(project.kickoffAmount * 100) / 100
    if (amount > 0) {
      const debited = await tx.user.updateMany({
        where: { id: project.userId, walletBalance: { gte: amount } },
        data: { walletBalance: { decrement: amount } },
      })
      if (debited.count === 0) {
        const owner = await tx.user.findUnique({ where: { id: project.userId }, select: { walletBalance: true } })
        // Throwing rolls back the claim above, so the kickoff can be retried.
        throw new KickoffShortfall(Math.round((amount - (owner?.walletBalance ?? 0)) * 100) / 100)
      }
      const label = project.payMode === 'fixed-full'
        ? 'Payment in full'
        : project.payMode === 'retainer'
          ? 'Set-up and first month'
          : project.payMode === 'scope'
            ? 'Discovery fee'
            : 'Deposit'
      await tx.transaction.create({
        data: {
          userId: project.userId,
          amount: -amount,
          type: 'PAYMENT',
          category: project.category,
          installmentId: project.installmentPlan?.id ?? null,
          projectId: project.id,
          description: `${label} — ${project.name}${opts?.actorNote ? ` (${opts.actorNote})` : ''}`,
        },
      })
    }

    const now = new Date()
    await tx.project.update({
      where: { id: projectId },
      data: { status: 'IN_PROGRESS', progress: Math.max(project.progress, 5) },
    })
    // The kickoff milestone is done; the next one is now in hand. Undated
    // milestones come back in insertion order, which is the timeline.
    const first = project.milestones.find(m => m.status === 'CURRENT') ?? project.milestones[0]
    if (first && first.status !== 'COMPLETED') {
      await tx.milestone.update({ where: { id: first.id }, data: { status: 'COMPLETED', date: now } })
      const next = project.milestones.find(m => m.status === 'PENDING')
      if (next) {
        await tx.milestone.update({ where: { id: next.id }, data: { status: 'CURRENT' } })
      }
    }
    if (project.installmentPlan && project.installmentPlan.status === 'pending') {
      await tx.installment.update({
        where: { id: project.installmentPlan.id },
        data: { status: 'active', nextDue: firstPaymentDate(now) },
      })
    }
    await tx.notification.create({
      data: {
        userId: project.userId,
        title: 'Work has started',
        message: amount > 0
          ? `${project.name}: £${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })} was taken from your wallet and work has started.`
          : `${project.name}: work has started.`,
        type: 'SUCCESS',
        link: `/dashboards/orders?project=${project.id}`,
      },
    })
    return { ok: true as const, charged: amount }
  }).catch((error: unknown) => {
    if (error instanceof KickoffShortfall) {
      return { ok: false as const, reason: 'insufficient_funds' as const, shortBy: error.shortBy }
    }
    throw error
  })
}
