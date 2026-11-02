/* eslint-disable test/no-import-node-test -- Node's own runner, no framework */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * The platform log (shared/log.ts) seen from outside: every response names
 * its request, an API error carries the same id, the request's lines are in
 * the file with the actor, the route and the database counters, nothing
 * secret reaches the file, and the console's Logs screen reads it back for
 * the owner only. Needs `CMS_TEST_URL`; the log directory is the dev
 * server's default (`.demo/.data/logs`) unless `LOG_TEST_DIR` says otherwise.
 */

const LOG_DIR = process.env.LOG_TEST_DIR ?? path.join(import.meta.dirname, '../../.data/logs')

function linesFor(requestId: string): any[] {
  const day = new Date().toISOString().slice(0, 10)
  const file = path.join(LOG_DIR, `panel-${day}.jsonl`)
  if (!fs.existsSync(file)) {
    return []
  }
  return fs.readFileSync(file, 'utf8').split('\n').filter(l => l.includes(requestId)).map(l => JSON.parse(l))
}

/** The summary line is written as the response ends; give the stream a moment to flush. */
async function waitForLines(requestId: string, predicate: (lines: any[]) => boolean): Promise<any[]> {
  for (let i = 0; i < 30; i++) {
    const lines = linesFor(requestId)
    if (predicate(lines)) {
      return lines
    }
    await new Promise(r => setTimeout(r, 100))
  }
  return linesFor(requestId)
}

describe('platform log', { skip: !enabled && 'CMS_TEST_URL is not set' }, () => {
  it('names every request, and an API error carries the same id', async () => {
    const health = await client().fetch('/api/health')
    assert.equal(health.status, 200)
    assert.match(health.headers.get('x-request-id') ?? '', /^[\w-]{8,64}$/)
    const body = await health.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.db, 'ok')

    const denied = await client().fetch('/api/admin/stats')
    assert.equal(denied.status, 401)
    const id = denied.headers.get('x-request-id')
    const err = await denied.json()
    assert.equal(err.data?.requestId, id, 'the error body quotes the request id')

    const lines = await waitForLines(id!, l => l.some(x => x.event === 'http.request'))
    const req = lines.find(x => x.event === 'http.request')
    assert.ok(req, 'the request line is in the file')
    assert.equal(req.level, 'warn')
    assert.equal(req.outcome, 'denied')
    assert.equal(req.http.status, 401)
    assert.equal(req.http.route, '/api/admin/stats')
    assert.equal(req.actor.kind, 'anonymous')
  })

  it('records a failed sign-in without the password or the address', async () => {
    const email = `log-probe-${Date.now()}@example.test`
    const password = `Secret-${Date.now()}-value`
    const res = await client().fetch('/api/auth/login', { method: 'POST', json: { identifier: email, password } })
    assert.equal(res.status, 401)
    const id = res.headers.get('x-request-id')!
    const lines = await waitForLines(id, l => l.some(x => x.event === 'http.request') && l.some(x => x.event === 'audit.auth.login.failed'))
    const raw = lines.map(l => JSON.stringify(l)).join('\n')
    assert.ok(lines.some(x => x.event === 'audit.auth.login.failed' && x.category === 'auth'), 'the failure is an auth line')
    assert.ok(lines.some(x => x.event === 'db.create' && x.data?.model === 'AuditLog'), 'the audit write is a db line of the same request')
    const req = lines.find(x => x.event === 'http.request')
    assert.deepEqual(req.http.bodyKeys, ['identifier', 'password'], 'field names, not values')
    assert.ok(!raw.includes(password), 'the password never reaches the log')
    assert.ok(!raw.includes(email), 'the address never reaches the log')
  })

  it('names the signed-in customer and counts the queries', async () => {
    const customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
    const res = await customer.fetch('/api/dashboard/overview')
    assert.equal(res.status, 200)
    const id = res.headers.get('x-request-id')!
    const lines = await waitForLines(id, l => l.some(x => x.event === 'http.request'))
    const req = lines.find(x => x.event === 'http.request')
    assert.equal(req.actor.kind, 'customer')
    assert.ok(req.actor.id)
    assert.ok(req.db.queries > 0, 'the query counter is filled in')
    assert.equal(req.outcome, 'success')
  })

  it('records a validation failure with the fields that failed', async () => {
    const res = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: 'not-an-identifier' } })
    assert.equal(res.status, 400)
    const id = res.headers.get('x-request-id')!
    const lines = await waitForLines(id, l => l.some(x => x.event === 'http.request'))
    const req = lines.find(x => x.event === 'http.request')
    assert.deepEqual(req.error.fields, ['password'])
    assert.equal(req.outcome, 'failure')
  })

  it('reads the log back for the owner only', async () => {
    const owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    const list = await owner.json<any>('/api/admin/logs?level=warn&limit=20')
    assert.equal(list.status, 200)
    assert.ok(Array.isArray(list.body.items))
    assert.ok(list.body.items.every((l: any) => l.level === 'warn' || l.level === 'error'), 'the level filter holds')
    assert.ok(list.body.apps.includes('panel'))

    const one = list.body.items.find((l: any) => l.requestId)
    if (one) {
      const byRequest = await owner.json<any>(`/api/admin/logs?requestId=${one.requestId}`)
      assert.ok(byRequest.body.items.length > 0)
      assert.ok(byRequest.body.items.every((l: any) => l.requestId === one.requestId))
    }

    const summary = await owner.json<any>('/api/admin/logs/summary')
    assert.equal(summary.status, 200)
    assert.ok(summary.body.lines > 0)
    assert.ok(typeof summary.body.byLevel === 'object')
    assert.ok(Array.isArray(summary.body.routes))

    const bad = await owner.json<any>('/api/admin/logs?days=99')
    assert.equal(bad.status, 400)

    const support = await staffClient(owner, 'support')
    assert.equal((await support.fetch('/api/admin/logs')).status, 403)
    assert.equal((await client().fetch('/api/admin/logs')).status, 401)
    const customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
    assert.equal((await customer.fetch('/api/admin/logs/summary')).status, 403)

    const page = await owner.fetch('/admin/logs')
    assert.equal(page.status, 200)
  })
})
