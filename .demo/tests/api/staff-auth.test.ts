import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { BASE, client, DEV_ACCOUNTS, enabled, login, resetRateLimits, staffLogin } from './helpers.ts'
import { totp } from './staff-session.ts'

/**
 * Staff sign-in (ADR-025): the admin API takes only a staff session, which
 * only the staff sign-in makes, and only after an authenticator code.
 */
async function post(path: string, json: unknown, cookie = '') {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': BASE, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(json),
  })
  const text = await res.text()
  let body: any = text
  try {
    body = JSON.parse(text)
  }
  catch {}
  return { status: res.status, body, setCookie: res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') }
}

describe('staff sign-in', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let customer: Client

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
  })

  it('the customer sign-in turns a staff account away, after the password, and points at the staff sign-in', async () => {
    await resetRateLimits()
    const res = await post('/api/auth/login', { identifier: DEV_ACCOUNTS.owner.identifier, password: DEV_ACCOUNTS.owner.password })
    assert.equal(res.status, 403)
    assert.equal(res.body.data.signIn, '/admin/sign-in')
    assert.equal(res.setCookie, '', 'no cookie of any kind')
    const wrong = await post('/api/auth/login', { identifier: DEV_ACCOUNTS.owner.identifier, password: 'not-the-password' })
    assert.equal(wrong.status, 401, 'a wrong password does not reveal a staff account')
  })

  it('the staff sign-in answers one 401 for an unknown address, a wrong password and a customer account', async () => {
    await resetRateLimits()
    const unknown = await post('/api/admin/auth/login', { email: 'nobody-here@example.test', password: 'whatever-123' })
    const wrong = await post('/api/admin/auth/login', { email: DEV_ACCOUNTS.owner.identifier, password: 'not-the-password' })
    const cust = await post('/api/admin/auth/login', { email: DEV_ACCOUNTS.customer.identifier, password: DEV_ACCOUNTS.customer.password })
    for (const r of [unknown, wrong, cust]) {
      assert.equal(r.status, 401)
      assert.equal(r.body.message, 'Invalid email or password')
      assert.equal(r.setCookie, '')
    }
  })

  it('a right password alone sets no cookie, and its ticket is not a session', async () => {
    await resetRateLimits()
    const res = await post('/api/admin/auth/login', { email: DEV_ACCOUNTS.owner.identifier, password: DEV_ACCOUNTS.owner.password })
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'two_factor')
    assert.equal(res.setCookie, '')
    for (const name of ['apex_admin', 'auth_token']) {
      const as = await client(`${name}=${res.body.ticket}`).json('/api/admin/stats')
      assert.equal(as.status, 401, `a ticket in ${name} is refused`)
    }
    const bad = await post('/api/admin/auth/login-2fa', { ticket: res.body.ticket, code: '000000' })
    assert.equal(bad.status, 400)
    assert.equal(bad.setCookie, '')
  })

  it('the admin API takes a staff session and nothing else', async () => {
    assert.equal((await owner.json('/api/admin/stats')).status, 200)
    const me = await owner.json<any>('/api/auth/me')
    assert.equal(me.body.user.sessionKind, 'staff')
    assert.match(owner.cookie, /apex_admin=/)
    assert.doesNotMatch(owner.cookie, /auth_token=[^;\s]/, 'the customer cookie is cleared, not set')

    assert.equal((await customer.json('/api/admin/stats')).status, 403, 'a customer session on the admin API')
    assert.equal((await client().json('/api/admin/stats')).status, 401, 'no session')
    const customerToken = customer.cookie.match(/auth_token=([^;]+)/)?.[1]
    assert.ok(customerToken)
    const moved = await client(`apex_admin=${customerToken}`).json('/api/admin/stats')
    assert.equal(moved.status, 401, 'a customer token copied into the staff cookie is ignored')
  })

  it('a staff member who has not set up two-step is enrolled before any session, and a code works once', async () => {
    const stamp = Date.now().toString(36)
    const email = `staff-enrol-${stamp}@example.test`
    const password = `Staff-${stamp}-password`
    const invite = await owner.json<any>('/api/admin/team/invites', { method: 'POST', json: { email, name: 'Enrol Tester', role: 'support' } })
    assert.equal(invite.status, 200, JSON.stringify(invite.body))
    const token = new URL(invite.body.acceptUrl, BASE).searchParams.get('token')
    const accepted = await post('/api/auth/accept-invite', { token, password })
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body))
    assert.equal(accepted.setCookie, '', 'accepting an invite starts no session')
    assert.match(accepted.body.signIn, /^\/admin\/sign-in\?email=/)

    await resetRateLimits()
    const first = await post('/api/admin/auth/login', { email, password })
    assert.equal(first.body.status, 'enrol')
    assert.equal(first.setCookie, '')
    const wrongTicket = await post('/api/admin/auth/login-2fa', { ticket: first.body.ticket, code: '123456' })
    assert.equal(wrongTicket.status, 401, 'an enrolment ticket is not a code ticket')

    const start = await post('/api/admin/auth/enrol/start', { ticket: first.body.ticket })
    assert.equal(start.status, 200)
    assert.match(start.body.uri, /^otpauth:\/\/totp\//)
    const step = Math.floor(Date.now() / 30_000)
    const finish = await post('/api/admin/auth/enrol/finish', { ticket: first.body.ticket, code: totp(start.body.secret, step) })
    assert.equal(finish.status, 200, JSON.stringify(finish.body))
    assert.equal(finish.body.backupCodes.length, 10)
    assert.match(finish.setCookie, /apex_admin=/)
    const support = client(finish.setCookie)
    assert.equal((await support.json('/api/admin/tickets')).status, 200)
    assert.equal((await support.json('/api/admin/team')).status, 403, 'the role matrix still applies')

    await resetRateLimits()
    const second = await post('/api/admin/auth/login', { email, password })
    assert.equal(second.body.status, 'two_factor', 'two-step is on from now on')
    const replay = await post('/api/admin/auth/login-2fa', { ticket: second.body.ticket, code: totp(start.body.secret, step) })
    assert.equal(replay.status, 400, 'the code used at enrolment cannot be used again')
    const backup = await post('/api/admin/auth/login-2fa', { ticket: second.body.ticket, code: finish.body.backupCodes[0] })
    assert.equal(backup.status, 200, 'a backup code signs in')
    assert.equal(backup.body.via, 'backup')

    // Signing out ends the session server-side: the old cookie stops working.
    const out = await support.json('/api/auth/logout', { method: 'POST' })
    assert.equal(out.status, 200)
    assert.equal((await support.json('/api/admin/tickets')).status, 401)
  })

  it('the staff sign-in blocks after five wrong passwords for an address', async () => {
    await resetRateLimits()
    const email = `limit-${Date.now().toString(36)}@example.test`
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      statuses.push((await post('/api/admin/auth/login', { email, password: `wrong-${i}` })).status)
    }
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429])
    await resetRateLimits()
  })

  it('a staff session also works for the shared routes staff use', async () => {
    assert.equal((await owner.json('/api/notifications')).status, 200)
    assert.equal((await staffLogin(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)).cookie, owner.cookie, 'the harness reuses a live session')
  })
})
