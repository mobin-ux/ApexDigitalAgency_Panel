import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { client, DEV_ACCOUNTS, enabled, login } from './helpers.ts'

/**
 * The money guardrails (ADR-025) through the real endpoints: no plan longer
 * than twelve payments, a late kickoff compressing the dates into twelve
 * months from signing, credit approval and interest behind switches that are
 * off, no hand-edited wallets or signed prices, and top-ups refunded through
 * the provider. Back-dating an order's signature is the one thing no route
 * can do, so this suite writes that single column to the local database.
 */
const DAY = 86_400_000

describe('money guardrails', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let customer: Client
  let customerId = ''
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    // A fresh customer: no open plans, so one fixed plan is allowed without a credit line.
    const stamp = Date.now().toString(36)
    const signup = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: `guardrails-${stamp}@example.test`, password: `Guardrails-${stamp}-pass`, name: 'Guardrail Tester' } })
    assert.equal(signup.status, 200, await signup.clone().text())
    customer = client(signup.headers.getSetCookie().map(c => c.split(';')[0]).join('; '))
    customerId = (await customer.json<any>('/api/auth/me')).body.user.id
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it('the catalogue refuses a plan with more than twelve payments', async () => {
    const current = await owner.json<any>('/api/admin/services')
    assert.equal(current.status, 200)
    const services = structuredClone(current.body.catalog?.services ?? current.body.services)
    const fixed = services.find((s: any) => s.kind === 'fixed')
    fixed.payments = 24
    const res = await owner.json<any>('/api/admin/services', { method: 'PUT', json: { services } })
    assert.equal(res.status, 400, JSON.stringify(res.body).slice(0, 300))
  })

  it('interest-bearing plans are off and nothing offers the 24-month term', async () => {
    const config = await customer.json<any>('/api/config')
    assert.equal(config.body.finance.enable24moPlans, false)
  })

  it('approving credit is switched off; declining is not', async () => {
    const approve = await owner.json<any>('/api/admin/credit/applications/does-not-exist/decide', { method: 'POST', json: { action: 'approve', limit: 1000 } })
    assert.equal(approve.status, 409)
    assert.equal(approve.body.data.flag, 'NUXT_LENDING_CREDIT_DECISIONS')
    const decline = await owner.json<any>('/api/admin/credit/applications/does-not-exist/decide', { method: 'POST', json: { action: 'decline' } })
    assert.equal(decline.status, 404, 'a decline is only refused for not existing')
    const list = await owner.json<any>('/api/admin/credit/applications')
    assert.equal(list.body.approvalsEnabled, false)
  })

  it('staff cannot add to or take from a wallet by hand any more', async () => {
    const res = await owner.json<any>(`/api/admin/users/${customerId}/wallet`, { method: 'POST', json: { amount: 100, reason: 'test' } })
    assert.ok([404, 405].includes(res.status), `answered ${res.status}`)
  })

  it('a late kickoff compresses the remaining dates to end within twelve months, at the same amounts', async () => {
    const catalog = (await customer.json<any>('/api/config')).body
    assert.ok(catalog)
    const order = await customer.json<any>('/api/orders', {
      method: 'POST',
      json: { title: `Guardrails ${Date.now().toString(36)}`, serviceId: 'web', planId: 'starter', pay: 'monthly', signature: 'Guardrail Tester', signatureType: 'typed', signerName: 'Guardrail Tester' },
    })
    assert.equal(order.status, 200, JSON.stringify(order.body).slice(0, 400))
    const projectId = order.body.project?.id ?? order.body.id
    assert.ok(projectId, JSON.stringify(order.body).slice(0, 200))

    // Signed ten months ago: twelve monthly payments cannot fit any more.
    const signedAt = new Date(Date.now() - 300 * DAY)
    await prisma.project.update({ where: { id: projectId }, data: { signedAt } })
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { installmentPlan: true } })
    const plan = project.installmentPlan!
    assert.equal(plan.monthsTotal, 12)

    // Fund the kickoff through the mock rail, then collect it as staff.
    const topup = await customer.json<any>('/api/finance/topup', { method: 'POST', json: { amount: Math.ceil(project.kickoffAmount) + 1 } })
    assert.equal(topup.status, 200, JSON.stringify(topup.body).slice(0, 300))
    const kickoff = await owner.json<any>(`/api/admin/projects/${projectId}/kickoff`, { method: 'POST' })
    assert.equal(kickoff.status, 200, JSON.stringify(kickoff.body).slice(0, 300))

    const started = await prisma.installment.findUniqueOrThrow({ where: { id: plan.id } })
    const deadline = new Date(signedAt.getFullYear(), signedAt.getMonth() + 12, signedAt.getDate())
    assert.equal(started.monthsPaid, 1, 'payment 1 was the kickoff')
    assert.equal(started.monthlyAmount, plan.monthlyAmount, 'the amount did not change')
    assert.ok(started.nextDue <= deadline, `next due ${started.nextDue.toISOString()} is after the deadline ${deadline.toISOString()}`)
    assert.ok(started.nextDue.getTime() - Date.now() < 45 * DAY, 'the next payment is not a month-plus away when eleven must fit in two months')

    // Each payment moves the next date by the compressed step, never past the deadline.
    await customer.json('/api/finance/topup', { method: 'POST', json: { amount: Math.ceil(plan.monthlyAmount * 11) + 1 } })
    let last = started.nextDue
    for (let k = 0; k < 10; k++) {
      const pay = await customer.json<any>(`/api/finance/installments/${plan.id}/pay`, { method: 'POST' })
      assert.equal(pay.status, 200, JSON.stringify(pay.body).slice(0, 300))
      const now = await prisma.installment.findUniqueOrThrow({ where: { id: plan.id } })
      assert.ok(now.nextDue >= last && now.nextDue <= deadline, `payment ${k + 2}: ${now.nextDue.toISOString()}`)
      last = now.nextDue
    }
    assert.ok(Math.abs(last.getTime() - deadline.getTime()) < 2 * DAY, 'the last payment falls on the deadline')
    const kickoffNote = await prisma.notification.findFirst({ where: { userId: customerId, title: 'Work has started' }, orderBy: { createdAt: 'desc' } })
    assert.match(kickoffNote?.message ?? '', /closer together/, 'the client is told the dates moved')

    // A signed project's value is fixed.
    const patch = await owner.json<any>(`/api/admin/projects/${projectId}`, { method: 'PATCH', json: { amount: 1 } })
    assert.equal(patch.status, 409)
  })

  it('a top-up is refunded to the card through the provider, once, and only from what is in the wallet', async () => {
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: customerId } })).walletBalance
    const topup = await customer.json<any>('/api/finance/topup', { method: 'POST', json: { amount: 40 } })
    assert.equal(topup.status, 200)
    const deposit = await prisma.transaction.findFirstOrThrow({ where: { userId: customerId, type: 'DEPOSIT' }, orderBy: { createdAt: 'desc' } })

    const half = await owner.json<any>('/api/admin/finance/refund', { method: 'POST', json: { transactionId: deposit.id, reason: 'Test partial refund', amount: 1500 } })
    assert.equal(half.status, 200, JSON.stringify(half.body))
    assert.equal(half.body.to, 'card')
    assert.equal(half.body.status, 'succeeded', 'the mock rail confirms at once')
    const rest = await owner.json<any>('/api/admin/finance/refund', { method: 'POST', json: { transactionId: deposit.id, reason: 'Test remaining refund' } })
    assert.equal(rest.status, 200, JSON.stringify(rest.body))
    assert.equal(rest.body.amount, 2500)
    const again = await owner.json<any>('/api/admin/finance/refund', { method: 'POST', json: { transactionId: deposit.id, reason: 'Test a third time' } })
    assert.equal(again.status, 400, 'nothing left to refund')

    const afterBalance = (await prisma.user.findUniqueOrThrow({ where: { id: customerId } })).walletBalance
    assert.equal(Math.round((afterBalance - before) * 100), 0, 'the top-up left the wallet again, exactly')
    const refunds = await prisma.refund.findMany({ where: { paymentIntent: { userId: customerId } } })
    assert.equal(refunds.length, 2)
    assert.ok(refunds.every(r => r.status === 'succeeded' && r.providerRefundId))
  })

  it('only staff with money.refund may refund', async () => {
    const res = await customer.json<any>('/api/admin/finance/refund', { method: 'POST', json: { transactionId: 'x', reason: 'not mine' } })
    assert.equal(res.status, 403)
  })
})
