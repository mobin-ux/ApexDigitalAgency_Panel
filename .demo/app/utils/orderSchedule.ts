import type { ApexTone } from '~/utils/panel'
import { ukDate } from '~/utils/panel'

/**
 * An order's payment schedule, from what the server stores (ADR-019): the
 * kickoff amount and whether it was taken, plus the instalment plan's
 * counters and next due date. My orders' Payments tab, its plan card and
 * Wallet's Payment plans all read this, so "3 of 12 paid" cannot be three
 * different numbers on three screens.
 *
 * Future dates are the plan's `nextDue` stepped a month at a time — the same
 * rule `chargeInstallment` uses to move it — and before kickoff they are
 * labelled as an estimate by the caller.
 */
export interface ScheduleInput {
  payMode?: string | null
  kickoffAmount?: number | null
  kickoffPaidAt?: string | Date | null
  createdAt?: string | Date | null
  amount?: number | null
  installmentPlan?: null | {
    kind?: string | null
    status: string
    monthsPaid: number
    monthsTotal: number
    monthlyAmount: number
    amountDue: number
    nextDue: string | Date
    paid: number
    total: number
    depositAmount?: number | null
  }
}

export interface ScheduleRow {
  label: string
  date: string
  amount: number
  state: 'Paid' | 'Next' | 'Upcoming' | 'Rolling'
  tone: ApexTone
}

export interface Schedule {
  rows: ScheduleRow[]
  paid: number
  total: number
  monthly: number
  payments: number
  paidCount: number
  retainer: boolean
  started: boolean
  nextDue: Date | null
  kind: 'fixed' | 'full' | 'retainer' | 'scope' | 'legacy' | 'none'
}

const TONE: Record<ScheduleRow['state'], ApexTone> = { Paid: 'success', Next: 'violet', Upcoming: 'neutral', Rolling: 'neutral' }

function row(label: string, date: string, amount: number, state: ScheduleRow['state']): ScheduleRow {
  return { label, date, amount, state, tone: TONE[state] }
}

function monthAfter(from: Date, i: number): Date {
  return new Date(from.getFullYear(), from.getMonth() + i, from.getDate())
}

export function orderSchedule(p: ScheduleInput): Schedule {
  const plan = p.installmentPlan ?? null
  const kickoff = p.kickoffAmount ?? 0
  const started = Boolean(p.kickoffPaidAt)
  const kickoffDate = started ? ukDate(p.kickoffPaidAt!) : 'At kickoff'
  const kickoffState: ScheduleRow['state'] = started ? 'Paid' : 'Next'
  const next = plan ? new Date(plan.nextDue) : null

  // The monthly rows after kickoff, shared by fixed plans and retainers.
  function instalments(count: number, label: (i: number) => string) {
    const rows: ScheduleRow[] = []
    if (!plan || !next) {
      return rows
    }
    for (let i = 0; i < count; i++) {
      const paid = i < plan.monthsPaid
      const state: ScheduleRow['state'] = paid ? 'Paid' : (started && i === plan.monthsPaid ? 'Next' : 'Upcoming')
      rows.push(row(label(i), paid ? 'Paid' : ukDate(monthAfter(next, i - plan.monthsPaid)), plan.monthlyAmount, state))
    }
    return rows
  }

  switch (p.payMode) {
    case 'fixed-monthly': {
      const n = plan?.monthsTotal ?? 0
      const deposit = plan?.depositAmount ?? kickoff
      const rows = [row('Deposit', kickoffDate, deposit, kickoffState), ...instalments(n, i => `Payment ${i + 1} of ${n}`)]
      return {
        rows,
        paid: (started ? deposit : 0) + (plan?.paid ?? 0),
        total: deposit + n * (plan?.monthlyAmount ?? 0),
        monthly: plan?.monthlyAmount ?? 0,
        payments: n,
        paidCount: plan?.monthsPaid ?? 0,
        retainer: false,
        started,
        nextDue: started ? next : null,
        kind: 'fixed',
      }
    }
    case 'fixed-full':
      return { rows: [row('Full payment', kickoffDate, kickoff, kickoffState)], paid: started ? kickoff : 0, total: kickoff, monthly: 0, payments: 0, paidCount: 0, retainer: false, started, nextDue: null, kind: 'full' }
    case 'retainer': {
      const remaining = plan?.monthsTotal ?? 0
      const min = remaining + 1
      const monthly = plan?.monthlyAmount ?? kickoff
      const setup = Math.max(0, kickoff - monthly)
      const rows: ScheduleRow[] = []
      if (setup > 0) {
        rows.push(row('Set-up fee', kickoffDate, setup, kickoffState))
      }
      rows.push(row(`Month 1 of ${min}`, kickoffDate, monthly, kickoffState))
      rows.push(...instalments(remaining, i => `Month ${i + 2} of ${min}`))
      return {
        rows,
        paid: (started ? kickoff : 0) + (plan?.paid ?? 0),
        total: setup + monthly * min,
        monthly,
        payments: min,
        paidCount: (started ? 1 : 0) + (plan?.monthsPaid ?? 0),
        retainer: true,
        started,
        nextDue: started ? next : null,
        kind: 'retainer',
      }
    }
    case 'scope':
      return {
        rows: kickoff > 0 ? [row('Discovery, fixed price', started ? kickoffDate : 'When discovery starts', kickoff, kickoffState)] : [row('Scoping call', 'Free', 0, started ? 'Paid' : 'Next')],
        paid: started ? kickoff : 0,
        total: kickoff,
        monthly: 0,
        payments: 0,
        paidCount: 0,
        retainer: false,
        started,
        nextDue: null,
        kind: 'scope',
      }
  }

  // Orders placed before ADR-019: a plain plan of equal payments, no deposit.
  if (plan) {
    const n = plan.monthsTotal
    return {
      rows: instalmentsLegacy(),
      paid: plan.paid,
      total: plan.total,
      monthly: plan.monthlyAmount || plan.amountDue,
      payments: n,
      paidCount: plan.monthsPaid,
      retainer: false,
      started: true,
      nextDue: plan.status === 'settled' ? null : next,
      kind: 'legacy',
    }
  }
  return { rows: [], paid: 0, total: p.amount ?? 0, monthly: 0, payments: 0, paidCount: 0, retainer: false, started: true, nextDue: null, kind: 'none' }

  function instalmentsLegacy() {
    const rows: ScheduleRow[] = []
    for (let i = 0; i < plan!.monthsTotal; i++) {
      const paid = i < plan!.monthsPaid
      const state: ScheduleRow['state'] = paid ? 'Paid' : i === plan!.monthsPaid ? 'Next' : 'Upcoming'
      rows.push(row(`Payment ${i + 1} of ${plan!.monthsTotal}`, paid ? 'Paid' : ukDate(monthAfter(next!, i - plan!.monthsPaid)), plan!.monthlyAmount || plan!.amountDue, state))
    }
    return rows
  }
}
