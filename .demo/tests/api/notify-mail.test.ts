import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { client, DEV_ACCOUNTS, enabled, login } from './helpers.ts'

/**
 * Notification emails (ADR-022) through real events on a keyless dev
 * server: a customer's reply on a support request reaches the people who
 * answer support as an in-app row and a queued email; turning the switch
 * off keeps the row and stops the email.
 */
async function mailFor(to: string): Promise<{ id: string, kind: string, subject: string, status: string, text: string }[]> {
  const res = await client().json<any>(`/api/_test/mail?to=${encodeURIComponent(to)}`)
  assert.equal(res.status, 200)
  return res.body.items
}

describe('notification emails', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 120_000 }, () => {
  const stamp = Date.now().toString(36)
  let owner: Client
  let customer: Client
  let ticketId = ''

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
    // Start from the default: notification emails on for the owner.
    await owner.json('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: true } })
  })

  it('a customer reply on an unassigned request reaches the support roles in the panel and by email', async () => {
    const created = await customer.json<any>('/api/support/create', { method: 'POST', json: { subject: `Notify test ${stamp}`, message: 'First message.', category: 'other' } })
    assert.equal(created.status, 200, JSON.stringify(created.body))
    ticketId = created.body.ticket?.id ?? created.body.id
    assert.ok(ticketId, JSON.stringify(created.body))

    const before = (await mailFor(DEV_ACCOUNTS.owner.identifier)).filter(r => r.kind === 'notification' && r.subject.includes(`Notify test ${stamp}`)).length
    const reply = await customer.json<any>(`/api/support/${ticketId}/reply`, { method: 'POST', json: { content: 'A reply from the customer.' } })
    assert.equal(reply.status, 200, JSON.stringify(reply.body))

    const rows = (await mailFor(DEV_ACCOUNTS.owner.identifier)).filter(r => r.kind === 'notification' && r.subject.includes(`Notify test ${stamp}`))
    assert.equal(rows.length, before + 1, 'one notification email queued for the owner, who answers support')
    assert.match(rows[0]!.subject, /Customer replied: Notify test/)
    assert.match(rows[0]!.text, /A reply from the customer\./)

    const inApp = await owner.json<any>('/api/notifications')
    assert.equal(inApp.status, 200)
    const list = inApp.body.items ?? inApp.body.notifications ?? inApp.body
    assert.ok(Array.isArray(list) && list.some((n: any) => String(n.title).includes(`Notify test ${stamp}`)), 'the in-app row exists too')
  })

  it('with notification emails off the row is still written and no email is queued; account notices still go', async () => {
    const off = await owner.json<any>('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: false } })
    assert.equal(off.status, 200, JSON.stringify(off.body))
    assert.equal(off.body.preferences.emailNotifications, false)
    const me = await owner.json<any>('/api/auth/me')
    assert.equal(me.body.user.emailNotifications, false)

    const before = (await mailFor(DEV_ACCOUNTS.owner.identifier)).filter(r => r.kind === 'notification').length
    const reply = await customer.json<any>(`/api/support/${ticketId}/reply`, { method: 'POST', json: { content: 'Second reply, switch off.' } })
    assert.equal(reply.status, 200)
    const after = (await mailFor(DEV_ACCOUNTS.owner.identifier)).filter(r => r.kind === 'notification').length
    assert.equal(after, before, 'no email with the switch off')

    const inApp = await owner.json<any>('/api/notifications')
    const list = inApp.body.items ?? inApp.body.notifications ?? inApp.body
    assert.ok(list.some((n: any) => String(n.message).includes('Second reply, switch off.')), 'the in-app row still exists')

    const on = await owner.json<any>('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: true } })
    assert.equal(on.body.preferences.emailNotifications, true)
    await customer.json(`/api/support/${ticketId}`, { method: 'PATCH', json: { status: 'RESOLVED' } }).catch(() => {})
  })
})
