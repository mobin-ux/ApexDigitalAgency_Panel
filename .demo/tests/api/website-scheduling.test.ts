import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * Scheduling, key changes, duplicates and the panel documents through the
 * real endpoints. The scheduled publish is exercised through "run now"
 * (`POST /api/admin/website/publish-due`), which is the same function the
 * cron calls every minute: once the time has come it publishes exactly once.
 * The earliest allowed schedule is a minute out, so this suite waits that
 * minute once.
 */
describe('website scheduling, addresses and panel documents', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let editor: Client
  const stamp = Date.now().toString(36)

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    editor = await staffClient(owner, 'editor')
  })

  it('a schedule in the past is refused, a future one is recorded, run-now publishes it once when due', async () => {
    const created = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key: `/offers/sched-${stamp}`, title: 'Scheduled page' } })
    assert.equal(created.status, 200)
    const id = created.body.id
    const detail = await editor.json<any>(`/api/admin/website/documents/${id}`)
    await editor.json(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version: detail.body.draftVersion, content: { ...detail.body.draft, sections: [{ id: 'b1', type: 'banner', hidden: false, props: { text: 'Scheduled', tone: 'info' } }] } } })

    const past = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'schedule', scheduledFor: new Date(Date.now() - 1000).toISOString() } })
    assert.equal(past.status, 409)

    const when = new Date(Date.now() + 65_000)
    const scheduled = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'schedule', scheduledFor: when.toISOString() } })
    assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body))
    assert.equal(scheduled.body.state, 'scheduled')
    assert.ok(scheduled.body.scheduled, 'the scheduled revision is recorded')

    const early = await owner.json<any>('/api/admin/website/publish-due', { method: 'POST', json: {} })
    assert.equal(early.status, 200)
    assert.ok(!early.body.published.includes(`/offers/sched-${stamp}`), 'not due yet')

    await new Promise(resolve => setTimeout(resolve, 67_000))
    const due = await owner.json<any>('/api/admin/website/publish-due', { method: 'POST', json: {} })
    assert.ok(due.body.published.includes(`/offers/sched-${stamp}`), `published when due: ${JSON.stringify(due.body)}`)
    const again = await owner.json<any>('/api/admin/website/publish-due', { method: 'POST', json: {} })
    assert.ok(!again.body.published.includes(`/offers/sched-${stamp}`), 'a second run does nothing')

    const after = await editor.json<any>(`/api/admin/website/documents/${id}`)
    assert.equal(after.body.state, 'published')
    assert.equal(after.body.scheduled, null)

    const live = await owner.fetch(`/api/site/page?path=${encodeURIComponent(`/offers/sched-${stamp}`)}`)
    await live.arrayBuffer()
    assert.equal(live.status, 200)

    // Moving a live page creates a 301 from the old address.
    const moved = await owner.json<any>(`/api/admin/website/documents/${id}/key`, { method: 'PATCH', json: { key: `/offers/sched-${stamp}-moved` } })
    assert.equal(moved.status, 200, JSON.stringify(moved.body))
    assert.equal(moved.body.redirect, true)
    assert.equal(moved.body.key, `/offers/sched-${stamp}-moved`)
    const clash = await owner.json<any>(`/api/admin/website/documents/${created.body.id}/key`, { method: 'PATCH', json: { key: '/about' } })
    assert.equal(clash.status, 409)

    // A copy starts as a draft at a free address.
    const copy = await editor.json<any>(`/api/admin/website/documents/${id}/duplicate`, { method: 'POST', json: {} })
    assert.equal(copy.status, 200, JSON.stringify(copy.body))
    assert.equal(copy.body.state, 'draft')
    assert.equal(copy.body.key, `/offers/sched-${stamp}-moved-copy`)

    for (const docId of [id, copy.body.id]) {
      await owner.json(`/api/admin/website/documents/${docId}/transition`, { method: 'POST', json: { action: 'archive' } })
    }
  })

  it('panel documents reach /api/config only when published; the credit switch is enforced', async () => {
    const announcement = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'panel-announcement', title: 'Panel announcement', content: { enabled: true, text: `Hello ${stamp}`, tone: 'info', startsAt: '', endsAt: '' } } })
    if (announcement.status === 409) {
      // Already exists from an earlier run: edit that one instead.
      const existing = await editor.json<any>('/api/admin/website/documents?kind=panel&template=panel-announcement')
      announcement.body = existing.body.items[0]
    }
    const id = announcement.body.id
    const detail = await editor.json<any>(`/api/admin/website/documents/${id}`)
    await editor.json(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version: detail.body.draftVersion, content: { enabled: true, text: `Hello ${stamp}`, tone: 'info', startsAt: '', endsAt: '' } } })

    const before = await owner.json<any>('/api/config')
    assert.notEqual(before.body.announcement?.text, `Hello ${stamp}`, 'a draft is not served')

    const published = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(published.status, 200)
    const after = await owner.json<any>('/api/config')
    assert.equal(after.body.announcement?.text, `Hello ${stamp}`)
    const anonymous = await (await import('./helpers.ts')).client().json<any>('/api/config')
    assert.equal(anonymous.body.announcement?.text, `Hello ${stamp}`, 'signed-out readers see it too')
    assert.ok(after.body.dashboardPromo?.title, 'the promo always has words (baseline or document)')

    const unpublished = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'unpublish' } })
    assert.equal(unpublished.status, 200)
    const gone = await owner.json<any>('/api/config')
    assert.equal(gone.body.announcement, null)

    const closed = await owner.json<any>('/api/admin/website/panel-features', { method: 'PUT', json: { creditApplications: false } })
    assert.equal(closed.status, 200)
    const customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
    const cfg = await customer.json<any>('/api/config')
    assert.equal(cfg.body.features.creditApplications, false)
    const refused = await customer.json<any>('/api/credit/application', { method: 'POST', json: {} })
    assert.equal(refused.status, 409, 'a direct request is refused while closed')
    const denied = await editor.json<any>('/api/admin/website/panel-features', { method: 'PUT', json: { creditApplications: true } })
    assert.equal(denied.status, 403, 'an editor cannot change the switch')
    await owner.json('/api/admin/website/panel-features', { method: 'PUT', json: { creditApplications: true } })
  })
})
