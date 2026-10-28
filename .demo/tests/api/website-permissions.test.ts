import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { can, STAFF_ROLES } from '../../shared/permissions.ts'
import { client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * The website endpoints × every role. Each endpoint names the permission it
 * gates on; the expectation is derived from the matrix, so adding a row to
 * `shared/permissions.ts` changes what this suite expects without an edit
 * here. Anonymous callers get 401, customers 403, staff 200 or 403.
 */

const ENDPOINTS: { method: 'GET' | 'POST', path: string, permission: Parameters<typeof can>[1] }[] = [
  { method: 'GET', path: '/api/admin/website/overview', permission: 'website.view' },
]

describe('website endpoints by role', { skip: !enabled && 'CMS_TEST_URL is not set' }, () => {
  const clients: Partial<Record<typeof STAFF_ROLES[number] | 'customer', Client>> = {}

  before(async () => {
    const owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    clients.customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
    for (const role of STAFF_ROLES) {
      clients[role] = await staffClient(owner, role)
    }
  })

  for (const endpoint of ENDPOINTS) {
    it(`${endpoint.method} ${endpoint.path} answers by the matrix`, async () => {
      const anonymous = await client().json(endpoint.path, { method: endpoint.method })
      assert.equal(anonymous.status, 401, 'anonymous')

      const customer = await clients.customer!.json(endpoint.path, { method: endpoint.method })
      assert.equal(customer.status, 403, 'customer')

      for (const role of STAFF_ROLES) {
        const res = await clients[role]!.json(endpoint.path, { method: endpoint.method })
        const expected = can(role, endpoint.permission) ? 200 : 403
        assert.equal(res.status, expected, `${role} on ${endpoint.path}`)
        if (expected === 403) {
          assert.equal(res.body?.data?.permission, endpoint.permission, `${role} 403 names the permission`)
        }
      }
    })
  }

  it('an accepted invite grants exactly the invited role, with panel access', async () => {
    const me = await clients.editor!.json<{ user: { role: string, staffRole: string } }>('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.role, 'ADMIN')
    assert.equal(me.body.user.staffRole, 'editor')
    const overview = await clients.editor!.json('/api/admin/website/overview')
    assert.equal(overview.status, 200)
    const stats = await clients.editor!.json('/api/admin/stats')
    assert.equal(stats.status, 403, 'an editor has no work.view')
  })

  it('an editor asking for /admin is sent to the website module, not a 403 overview', async () => {
    const res = await clients.editor!.fetch('/admin')
    await res.arrayBuffer()
    assert.equal(res.status, 302)
    assert.equal(new URL(res.headers.get('location') ?? '', 'http://x').pathname, '/admin/website')
    const page = await clients.editor!.fetch('/admin/website')
    const html = await page.text()
    assert.equal(page.status, 200)
    assert.ok(html.includes('Nothing is managed yet') || html.includes('By status'), 'the website overview rendered')
  })

  it('the overview reports counts, not placeholders', async () => {
    const res = await clients.owner!.json<any>('/api/admin/website/overview')
    assert.equal(res.status, 200)
    assert.equal(typeof res.body.documents.total, 'number')
    assert.equal(typeof res.body.media.count, 'number')
    assert.ok(Array.isArray(res.body.recent))
  })
})
