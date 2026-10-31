import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { DEFAULT_CATALOG, FIXED_PLAN_MAX_PAYMENTS, orderTerms, paymentCount, planDeadline, planDueDates, underPlanLimit } from '../../shared/catalog.ts'

/**
 * The interest-free plan's guardrails (ADR-025): the same total whichever
 * way the client pays, at most twelve payments, and every payment inside
 * twelve months of signing — compressed, never moved later, amounts unchanged.
 */
const day = (iso: string) => new Date(`${iso}T00:00:00`)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('interest-free plan pricing', () => {
  it('every fixed plan costs the same in full as in monthly payments, with no interest', () => {
    for (const service of DEFAULT_CATALOG.services.filter(s => s.kind === 'fixed')) {
      for (const plan of service.plans) {
        const monthly = orderTerms(service, plan, 'monthly')
        const full = orderTerms(service, plan, 'full')
        assert.equal(full.total, monthly.total, `${service.id}/${plan.id}: cash and instalment totals differ`)
        assert.equal(monthly.deposit + monthly.payments * monthly.monthly, monthly.total, `${service.id}/${plan.id}: payments do not add up to the total`)
        assert.ok(monthly.payments <= FIXED_PLAN_MAX_PAYMENTS, `${service.id}/${plan.id}: more than twelve payments`)
      }
    }
  })

  it('a stored catalogue asking for more than twelve payments is read as twelve', () => {
    const service = { ...DEFAULT_CATALOG.services.find(s => s.kind === 'fixed')!, payments: 24 }
    const plan = { ...service.plans[0]!, payments: 36 }
    assert.equal(paymentCount(service, plan), 12)
    assert.equal(orderTerms(service, plan).payments, 12)
  })

  it('only interest-free fixed plans are under the twelve-month rule', () => {
    assert.equal(underPlanLimit({ kind: 'fixed', interestRate: 0 }), true)
    assert.equal(underPlanLimit({ kind: 'fixed', interestRate: 0.01 }), false)
    assert.equal(underPlanLimit({ kind: 'retainer', interestRate: 0 }), false)
  })
})

describe('twelve-month schedule', () => {
  const signed = day('2026-01-15')
  const deadline = planDeadline(signed)

  it('the deadline is twelve months after signing', () => {
    assert.equal(iso(deadline), '2027-01-15')
  })

  it('a plan that fits stays a month apart', () => {
    const dates = planDueDates(day('2026-03-01'), 11, deadline)
    assert.deepEqual(dates.map(iso), ['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'])
  })

  it('a late kickoff compresses the dates evenly so the last lands on the deadline', () => {
    const dates = planDueDates(day('2026-06-01'), 11, deadline)
    assert.equal(dates.length, 11)
    assert.equal(iso(dates[0]!), '2026-06-01', 'the first date never moves')
    assert.equal(iso(dates.at(-1)!), '2027-01-15', 'the last falls on the deadline')
    for (let i = 1; i < dates.length; i++) {
      assert.ok(dates[i]! > dates[i - 1]!, 'dates keep their order')
      assert.ok(dates[i]! <= deadline, 'nothing after the deadline')
    }
    const gaps = dates.slice(1).map((d, i) => Math.round((d.getTime() - dates[i]!.getTime()) / 86_400_000))
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, `even spacing, got ${gaps.join(',')}`)
  })

  it('stepping one payment at a time from the next date gives the same dates', () => {
    const whole = planDueDates(day('2026-06-01'), 11, deadline)
    let current = whole[0]!
    for (let k = 0; k < 10; k++) {
      const next = planDueDates(current, 11 - k, deadline)[1]!
      assert.ok(Math.abs(next.getTime() - whole[k + 1]!.getTime()) <= 86_400_000, `step ${k + 1}: ${iso(next)} vs ${iso(whole[k + 1]!)}`)
      current = next
    }
  })

  it('a kickoff after the deadline puts every remaining payment on the deadline', () => {
    const dates = planDueDates(day('2027-03-01'), 4, deadline)
    assert.deepEqual(dates.map(iso), ['2027-01-15', '2027-01-15', '2027-01-15', '2027-01-15'])
  })

  it('no deadline (a retainer) is a plain monthly schedule', () => {
    assert.deepEqual(planDueDates(day('2026-01-31'), 3, null).map(iso), ['2026-01-31', '2026-03-03', '2026-03-31'])
  })
})
