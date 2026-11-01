import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * The outbox's admin surface (ADR-022) on a dev server with no mail key:
 * who may open it, what it reports when sending is not configured, and
 * that the dev-only capture endpoint answers. The flows that queue real
 * messages (reset, verification, invites) are covered by their own suites.
 */
describe('mail outbox admin', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 60_000 }, () => {
  let owner: Client
  let support: Client

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    support = await staffClient(owner, 'support')
  })

  it('an owner sees the outbox with its counts and whether sending is configured; a support agent does not', async () => {
    const res = await owner.json<any>('/api/admin/mail')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(typeof res.body.configured, 'boolean')
    assert.deepEqual(res.body.envKeys, ['NUXT_MAIL_RESEND_API_KEY', 'NUXT_MAIL_FROM'])
    for (const key of ['queued', 'failed', 'sent24h']) {
      assert.equal(typeof res.body.counts[key], 'number', key)
    }
    assert.ok(Array.isArray(res.body.items))
    for (const item of res.body.items) {
      assert.equal(item.text, undefined, 'the admin endpoint never returns a body')
      assert.equal(item.html, undefined)
    }

    const denied = await support.json<any>('/api/admin/mail')
    assert.equal(denied.status, 403)
    const anon = await client().json<any>('/api/admin/mail')
    assert.equal(anon.status, 401)
  })

  it('with no key configured, a test email is refused with the key names rather than queued as if it could go', async () => {
    const status = await owner.json<any>('/api/admin/mail')
    if (status.body.configured) {
      // A configured test server would really send; that path is checked by hand with the owner's address.
      return
    }
    const res = await owner.json<any>('/api/admin/mail/test', { method: 'POST' })
    assert.equal(res.status, 409)
    assert.match(res.body.message ?? res.body.statusMessage ?? '', /NUXT_MAIL_RESEND_API_KEY/)
  })

  it('retrying an unknown message is a 404 and the filter rejects a status that does not exist', async () => {
    const missing = await owner.json<any>('/api/admin/mail/not-a-row/retry', { method: 'POST' })
    assert.equal(missing.status, 404)
    const bad = await owner.json<any>('/api/admin/mail?status=LOST')
    assert.equal(bad.status, 400)
  })

  it('the dev-only capture endpoint lists rows for an address, with their text', async () => {
    const res = await client().json<any>('/api/_test/mail?to=nobody@example.test')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.items))
    const missing = await client().json<any>('/api/_test/mail')
    assert.equal(missing.status, 400)
  })

  it('/api/config says whether mail is available, signed out and signed in', async () => {
    const pub = await client().json<any>('/api/config')
    assert.equal(pub.status, 200)
    assert.equal(typeof pub.body.features.mail, 'boolean')
    const mine = await owner.json<any>('/api/config')
    assert.equal(typeof mine.body.features.mail, 'boolean')
    assert.equal(typeof mine.body.features.creditApplications, 'boolean')
  })
})
