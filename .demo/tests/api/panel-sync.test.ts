import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { client, DEV_ACCOUNTS, enabled, login } from './helpers.ts'

/**
 * Two-way sync (ADR-025, phase 4): what staff do in the console is what the
 * client's own endpoints return next, with a notification from the same
 * event, and what the client does reaches the staff who handle it. Each
 * check reads the customer's own routes, not the admin ones.
 */
describe('admin and client panels stay in step', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let ownerId = ''
  let customer: Client
  let customerId = ''
  let projectId = ''
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)

  async function noticesFor(userId: string, title: RegExp) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
      .then(rows => rows.filter(n => title.test(n.title)))
  }

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    ownerId = (await owner.json<any>('/api/auth/me')).body.user.id
    const stamp = Date.now().toString(36)
    const signup = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: `sync-${stamp}@example.test`, password: `Sync-${stamp}-password`, name: 'Sync Tester' } })
    assert.equal(signup.status, 200, await signup.clone().text())
    customer = client(signup.headers.getSetCookie().map(c => c.split(';')[0]).join('; '))
    customerId = (await customer.json<any>('/api/auth/me')).body.user.id
    const order = await customer.json<any>('/api/orders', {
      method: 'POST',
      json: { title: `Sync ${stamp}`, serviceId: 'web', planId: 'starter', pay: 'monthly', signature: 'Sync Tester', signatureType: 'typed', signerName: 'Sync Tester' },
    })
    assert.equal(order.status, 200, JSON.stringify(order.body).slice(0, 400))
    projectId = order.body.project?.id ?? order.body.id
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it('a new request reaches support staff; a staff resolve reaches the client; a reopen goes back', async () => {
    const created = await customer.json<any>('/api/support/create', { method: 'POST', json: { category: 'other', message: 'Sync check: where is my invoice?' } })
    assert.equal(created.status, 200)
    const ticketId = created.body.ticket.id
    const staffNotice = (await noticesFor(ownerId, /^New request: Sync check/)).find(n => n.link === `/admin/tickets?ticket=${ticketId}`)
    assert.ok(staffNotice, 'everyone who answers support is told, with a link into the queue')

    const resolve = await owner.json<any>(`/api/admin/tickets/${ticketId}`, { method: 'PATCH', json: { status: 'RESOLVED' } })
    assert.equal(resolve.status, 200)
    const mine = await customer.json<any>('/api/support/tickets')
    assert.equal(mine.body.tickets.find((t: any) => t.id === ticketId)?.status, 'RESOLVED', 'the client sees the staff decision')
    const told = await customer.json<any>('/api/notifications')
    assert.ok(told.body.notifications.some((n: any) => n.title.startsWith('Request resolved') && n.link === `/dashboards/support?ticket=${ticketId}`))

    const reopen = await customer.json<any>(`/api/support/${ticketId}`, { method: 'PATCH', json: { status: 'OPEN' } })
    assert.equal(reopen.status, 200)
    assert.ok((await noticesFor(ownerId, /^Customer reopened: Sync check/)).length > 0, 'staff hear the client reopened it')
  })

  it('work on a paid-kickoff order starts through the kickoff, never by setting the status', async () => {
    const res = await owner.json<any>(`/api/admin/projects/${projectId}`, { method: 'PATCH', json: { status: 'IN_PROGRESS' } })
    assert.equal(res.status, 409)
    assert.match(res.body.message, /kickoff/i)
    const order = (await customer.json<any>('/api/orders')).body.data.find((o: any) => o.id === projectId)
    assert.equal(order.status, 'PENDING', 'the client still sees it awaiting kickoff')
  })

  it('a stage moved by staff is the client’s timeline, progress and notification', async () => {
    const advance = await owner.json<any>(`/api/admin/projects/${projectId}/advance`, { method: 'POST' })
    assert.equal(advance.status, 200, JSON.stringify(advance.body).slice(0, 300))
    const order = (await customer.json<any>('/api/orders')).body.data.find((o: any) => o.id === projectId)
    assert.equal(order.progress, advance.body.progress)
    assert.equal(order.milestones.find((m: any) => m.title === advance.body.completed)?.status, 'COMPLETED')
    const told = await customer.json<any>('/api/notifications')
    assert.ok(told.body.notifications.some((n: any) => n.link === `/dashboards/orders?project=${projectId}` && n.title.includes(advance.body.completed)))

    // Adding a stage recomputes progress, so the bar and the timeline agree.
    const added = await owner.json<any>(`/api/admin/projects/${projectId}/milestones`, { method: 'POST', json: { title: 'Sync extra stage' } })
    assert.equal(added.status, 200)
    const again = (await customer.json<any>('/api/orders')).body.data.find((o: any) => o.id === projectId)
    const done = again.milestones.filter((m: any) => m.status === 'COMPLETED').length
    assert.equal(again.progress, Math.round(done / again.milestones.length * 100))
  })

  it('cancelling stops the plan and the agreement on both sides, and stays cancelled', async () => {
    const plan = await prisma.installment.findUniqueOrThrow({ where: { projectId } })
    const cancel = await owner.json<any>(`/api/admin/projects/${projectId}`, { method: 'PATCH', json: { status: 'CANCELLED' } })
    assert.equal(cancel.status, 200, JSON.stringify(cancel.body).slice(0, 300))

    assert.equal((await prisma.installment.findUniqueOrThrow({ where: { id: plan.id } })).status, 'cancelled')
    const contract = await prisma.contract.findFirst({ where: { projectId } })
    if (contract) {
      assert.equal(contract.status, 'CANCELLED')
    }
    const pay = await customer.json<any>(`/api/finance/installments/${plan.id}/pay`, { method: 'POST' })
    assert.equal(pay.status, 409, 'the client cannot pay a cancelled plan')
    const kickoff = await owner.json<any>(`/api/admin/projects/${projectId}/kickoff`, { method: 'POST' })
    assert.equal(kickoff.status, 409, 'staff cannot collect a kickoff on it')

    const order = (await customer.json<any>('/api/orders')).body.data.find((o: any) => o.id === projectId)
    assert.equal(order.status, 'CANCELLED', 'the client sees the order cancelled')
    assert.equal(order.installmentPlan?.status, 'cancelled', 'and its plan stopped, which their schedule reads')
    const overview = await customer.json<any>('/api/dashboard/overview')
    assert.equal(overview.body.nextPayment, null, 'the dashboard shows nothing due')
    const told = await customer.json<any>('/api/notifications')
    assert.ok(told.body.notifications.some((n: any) => n.title === 'Project cancelled' && /No further payments/.test(n.message)))

    const revive = await owner.json<any>(`/api/admin/projects/${projectId}`, { method: 'PATCH', json: { status: 'IN_PROGRESS' } })
    assert.equal(revive.status, 409)
  })

  it('a withdrawal decision reaches the client', async () => {
    const request = await prisma.withdrawalRequest.create({ data: { userId: customerId, amount: 12.5, status: 'Processing' } })
    const res = await owner.json<any>(`/api/admin/finance/withdrawals/${request.id}`, { method: 'PATCH', json: { action: 'reject' } })
    assert.equal(res.status, 200)
    const told = await customer.json<any>('/api/notifications')
    assert.ok(told.body.notifications.some((n: any) => n.title === 'Withdrawal declined' && n.message.includes('£12.50')))
  })
})
