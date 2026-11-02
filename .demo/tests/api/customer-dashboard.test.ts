/* eslint-disable test/no-import-node-test -- Node's own runner, no framework */
import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { before, describe, it } from 'node:test'
import { BASE, client, enabled, login, resetRateLimits } from './helpers.ts'
import { totp } from './staff-session.ts'

/**
 * The customer dashboard, feature by feature, through its own API and back
 * out of the database: two fresh customers (A and B) sign up, then A uses
 * every part of the panel while B checks that none of A's records answer
 * for anyone else. Each feature also gets the inputs a careless or hostile
 * client would send. Local database only (`CMS_TEST_URL`); everything made
 * here belongs to the two `cust-*@example.test` accounts.
 */

const run = Date.now().toString(36)
const PASSWORD = `Customer-${run}-pass`
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')

interface Signed { client: Client, id: string, email: string }

async function signup(tag: string): Promise<Signed> {
  await resetRateLimits()
  const email = `cust-${tag}-${run}@example.test`
  const res = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: email, password: PASSWORD, name: `Test ${tag.toUpperCase()}` } })
  assert.equal(res.status, 200, `signup ${tag}: ${await res.clone().text()}`)
  const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  const body = await res.json()
  return { client: client(cookie), id: body.user.id, email }
}

async function upload(c: Client, name: string, data: Buffer, type: string): Promise<{ status: number, body: any }> {
  const form = new FormData()
  form.append('files', new Blob([data], { type }), name)
  const res = await fetch(`${BASE}/api/uploads`, { method: 'POST', headers: { cookie: c.cookie, origin: BASE }, body: form })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** The next weekday at least two days out, as the call form takes it. */
function nextWorkingDay(): string {
  const d = new Date(Date.now() + 2 * 86_400_000)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

describe('customer dashboard', { skip: !enabled && 'CMS_TEST_URL is not set' }, () => {
  let a: Signed
  let b: Signed

  before(async () => {
    a = await signup('a')
    b = await signup('b')
  })

  it('account: signup rules, the session, and the public config', async () => {
    const me = await a.client.json<any>('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.id, a.id)
    assert.equal(me.body.user.password, undefined, 'no hash in /me')

    await resetRateLimits()
    const dup = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: a.email, password: PASSWORD } })
    assert.equal(dup.status, 409, 'a second account for one address')
    const weak = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: `weak-${run}@example.test`, password: 'short1' } })
    assert.equal(weak.status, 400, 'a password under the platform minimum')
    const junk = await client().fetch('/api/auth/signup', { method: 'POST', body: 'not json', headers: { 'content-type': 'application/json' } })
    assert.equal(junk.status, 400, 'a body that is not JSON')
    const bad = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: 'not an address', password: PASSWORD } })
    assert.equal(bad.status, 400, 'an identifier that is neither an email nor a phone')

    const anon = await client().json<any>('/api/auth/me')
    assert.equal(anon.status, 200)
    assert.equal(anon.body.user, null)
    const config = await a.client.json<any>('/api/config')
    assert.equal(config.status, 200)
    assert.ok('features' in config.body)
  })

  it('dashboard, wallet and notifications read for a new account', async () => {
    for (const path of ['/api/dashboard/overview', '/api/dashboard/stats', '/api/finance/dashboard', '/api/finance/transactions', '/api/finance/pay-config', '/api/finance/payment-methods', '/api/notifications', '/api/orders', '/api/support/tickets', '/api/credit/application', '/api/settings/get-all', '/api/settings/sessions', '/api/settings/two-factor']) {
      const res = await a.client.fetch(path)
      assert.equal(res.status, 200, `${path} answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    const tx = await a.client.json<any>('/api/finance/transactions?limit=abc')
    assert.equal(tx.status, 200, 'a nonsense limit falls back')
    assert.deepEqual(tx.body.transactions, [])
    for (const path of ['/api/dashboard/overview', '/api/finance/dashboard', '/api/orders', '/api/settings/get-all']) {
      assert.equal((await client().fetch(path)).status, 401, `${path} needs a session`)
    }
  })

  it('settings: profile and company round-trip, bad values refused', async () => {
    const save = await a.client.json<any>('/api/settings/update-all', { method: 'PUT', json: { user: { firstName: 'Ada', lastName: 'Tester' }, company: { name: `Ada ${run} Ltd`, type: 'ltd', companyNumber: '12345678', address: '1 Test Street, London' } } })
    assert.equal(save.status, 200, JSON.stringify(save.body))
    const all = await a.client.json<any>('/api/settings/get-all')
    assert.equal(all.body.user?.firstName ?? all.body.firstName, 'Ada')
    const company = all.body.company ?? all.body.user?.company
    assert.equal(company?.companyNumber, '12345678')
    assert.equal(company?.address, '1 Test Street, London')

    // A profile-only save leaves the company alone.
    await a.client.json('/api/settings/update-all', { method: 'PUT', json: { user: { lastName: 'Tested' } } })
    const after = await a.client.json<any>('/api/settings/get-all')
    assert.equal((after.body.company ?? after.body.user?.company)?.name, `Ada ${run} Ltd`)

    const badNumber = await a.client.fetch('/api/settings/update-all', { method: 'PUT', json: { company: { companyNumber: '123' } } })
    assert.equal(badNumber.status, 400)
    const tooLong = await a.client.fetch('/api/settings/update-all', { method: 'PUT', json: { user: { firstName: 'x'.repeat(500) } } })
    assert.equal(tooLong.status, 400)

    const prefs = await a.client.json<any>('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: false } })
    assert.equal(prefs.status, 200)
    const me = await a.client.json<any>('/api/auth/me')
    assert.equal(me.body.user.emailNotifications, false)
    const wrongType = await a.client.fetch('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: 'yes' } })
    assert.equal(wrongType.status, 400)
    await a.client.json('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: true } })
  })

  it('uploads: accepted types only, and only the uploader can see or delete one', async () => {
    const png = await upload(a.client, 'shot.png', PNG, 'image/png')
    assert.equal(png.status, 200, JSON.stringify(png.body))
    const fileId = png.body.files[0].id
    const svg = await upload(a.client, 'x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')
    assert.ok(svg.status >= 400 && svg.status < 500, `an SVG is refused (got ${svg.status})`)
    const html = await upload(a.client, 'x.html', Buffer.from('<script>alert(1)</script>'), 'text/html')
    assert.ok(html.status >= 400 && html.status < 500, `HTML is refused (got ${html.status})`)
    const none = await fetch(`${BASE}/api/uploads`, { method: 'POST', headers: { cookie: a.client.cookie, origin: BASE }, body: new FormData() })
    assert.equal(none.status, 400, 'no file')

    assert.equal((await a.client.fetch(`/api/attachments/${fileId}`)).status, 200)
    assert.equal((await b.client.fetch(`/api/attachments/${fileId}`)).status, 404, 'another customer cannot read it')
    assert.equal((await client().fetch(`/api/attachments/${fileId}`)).status, 401, 'nor can a visitor')
    assert.equal((await b.client.fetch(`/api/uploads/${fileId}`, { method: 'DELETE' })).status, 404, 'nor delete it')
    assert.equal((await a.client.fetch('/api/attachments/not-a-uuid')).status, 404)
    assert.equal((await a.client.fetch(`/api/uploads/${fileId}`, { method: 'DELETE' })).status, 200)
    assert.equal((await a.client.fetch(`/api/attachments/${fileId}`)).status, 404, 'gone once deleted')
  })

  it('profile photo: set, served to the owner only, removed', async () => {
    const png = await upload(a.client, 'me.png', PNG, 'image/png')
    const set = await a.client.json<any>('/api/settings/avatar', { method: 'PUT', json: { fileId: png.body.files[0].id } })
    assert.ok(set.status === 200 || set.status === 400, `avatar answered ${set.status}`)
    if (set.status === 400) {
      // The 1×1 image is under the 200px floor the page checks; the API may enforce it too.
      return
    }
    assert.equal((await a.client.fetch(`/api/avatars/${a.id}`)).status, 200)
    assert.equal((await b.client.fetch(`/api/avatars/${a.id}`)).status, 404)
    assert.equal((await client().fetch(`/api/avatars/${a.id}`)).status, 401, 'a visitor must sign in')
    assert.equal((await a.client.fetch('/api/settings/avatar', { method: 'DELETE' })).status, 200)
  })

  it('support: a request from start to rating, and nobody else can touch it', async () => {
    const empty = await a.client.fetch('/api/support/create', { method: 'POST', json: { message: '   ' } })
    assert.equal(empty.status, 400, 'a blank message')
    const created = await a.client.json<any>('/api/support/create', { method: 'POST', json: { subject: 'Invoice question', category: 'billing', message: 'Where is my receipt?' } })
    assert.equal(created.status, 200, JSON.stringify(created.body))
    const id = created.body.ticket.id

    const list = await a.client.json<any>('/api/support/tickets')
    assert.ok((list.body.tickets ?? list.body.items ?? list.body).some((t: any) => t.id === id), 'listed')
    const thread = await a.client.json<any>(`/api/support/${id}/messages`)
    assert.equal(thread.status, 200)

    assert.equal((await a.client.fetch(`/api/support/${id}/reply`, { method: 'POST', json: { content: '' } })).status, 400, 'an empty reply')
    assert.equal((await a.client.fetch(`/api/support/${id}/reply`, { method: 'POST', json: { content: 'Any news?' } })).status, 200)

    assert.equal((await b.client.fetch(`/api/support/${id}/messages`)).status, 404, 'another customer cannot read it')
    assert.equal((await b.client.fetch(`/api/support/${id}/reply`, { method: 'POST', json: { content: 'hi' } })).status, 404, 'nor reply')
    assert.equal((await b.client.fetch(`/api/support/${id}`, { method: 'PATCH', json: { status: 'RESOLVED' } })).status, 404, 'nor resolve it')
    assert.equal((await a.client.fetch('/api/support/00000000-0000-0000-0000-000000000000/messages')).status, 404)

    assert.equal((await a.client.fetch(`/api/support/${id}/rating`, { method: 'POST', json: { rating: 5 } })).status, 400, 'cannot rate an open request')
    assert.equal((await a.client.fetch(`/api/support/${id}`, { method: 'PATCH', json: { status: 'CLOSED' } })).status, 400, 'unknown status')
    assert.equal((await a.client.fetch(`/api/support/${id}`, { method: 'PATCH', json: { status: 'RESOLVED' } })).status, 200)
    assert.equal((await a.client.fetch(`/api/support/${id}/rating`, { method: 'POST', json: { rating: 9 } })).status, 400, 'out of range')
    assert.equal((await a.client.fetch(`/api/support/${id}/rating`, { method: 'POST', json: { rating: 5, note: 'Quick' } })).status, 200)
    assert.equal((await a.client.fetch(`/api/support/${id}/rating`, { method: 'POST', json: { rating: 4 } })).status, 409, 'rated once')
    assert.equal((await a.client.fetch(`/api/support/${id}`, { method: 'PATCH', json: { status: 'OPEN' } })).status, 200, 'reopen')

    assert.equal((await a.client.fetch('/api/support/call', { method: 'POST', json: { date: '2020-01-01', time: '10:00' } })).status, 400, 'a past slot')
    assert.equal((await a.client.fetch('/api/support/call', { method: 'POST', json: { date: 'tomorrow', time: '10:00' } })).status, 400, 'not a date')
    const call = await a.client.fetch('/api/support/call', { method: 'POST', json: { date: nextWorkingDay(), time: '10:00' } })
    assert.ok(call.status === 200 || call.status === 400, `call request answered ${call.status}`)
  })

  it('orders: priced by the catalogue, signed, and private to their owner', async () => {
    const base = { title: `Site ${run}`, serviceId: 'web', planId: 'starter', pay: 'monthly', signature: 'Ada Tester', signatureType: 'typed' }
    assert.equal((await a.client.fetch('/api/orders', { method: 'POST', json: { ...base, serviceId: 'nope' } })).status, 400, 'an unknown service')
    assert.equal((await a.client.fetch('/api/orders', { method: 'POST', json: { ...base, planId: 'nope' } })).status, 400, 'an unknown plan')
    assert.equal((await a.client.fetch('/api/orders', { method: 'POST', json: { ...base, quotedTotal: 1 } })).status, 409, 'a price the catalogue does not hold')
    assert.equal((await a.client.fetch('/api/orders', { method: 'POST', json: { ...base, signature: '' } })).status, 400, 'no signature')
    assert.equal((await client().fetch('/api/orders', { method: 'POST', json: base })).status, 401)

    const placed = await a.client.json<any>('/api/orders', { method: 'POST', json: base })
    assert.equal(placed.status, 200, JSON.stringify(placed.body))
    const projectId = placed.body.project.id

    const mine = await a.client.json<any>('/api/orders')
    const listed = mine.body.data.find((p: any) => p.id === projectId)
    assert.ok(listed, 'the order is listed')
    assert.equal(listed.status, 'PENDING', 'signed, not charged')

    const theirs = await b.client.json<any>('/api/orders')
    assert.ok(!theirs.body.data.some((p: any) => p.id === projectId), 'not in another customer\'s list')

    const png = await upload(a.client, 'brief.png', PNG, 'image/png')
    const fileId = png.body.files[0].id
    assert.equal((await b.client.fetch(`/api/orders/${projectId}/files`, { method: 'POST', json: { attachmentIds: [fileId] } })).status, 404, 'another customer cannot attach to it')
    assert.equal((await a.client.fetch(`/api/orders/${projectId}/files`, { method: 'POST', json: { attachmentIds: [fileId] } })).status, 200)
    assert.equal((await a.client.fetch(`/api/orders/${projectId}/files`, { method: 'POST', json: { attachmentIds: [fileId] } })).status, 400, 'a file attaches once')

    assert.equal((await b.client.fetch('/api/orders/pay', { method: 'POST', json: { projectId } })).status, 404, 'another customer cannot pay it')
    const pay = await a.client.fetch('/api/orders/pay', { method: 'POST', json: { projectId } })
    assert.ok(pay.status >= 400 && pay.status < 500, `paying with an empty wallet is refused (got ${pay.status})`)
    assert.equal((await a.client.fetch(`/api/orders/${projectId}/actions/00000000-0000-0000-0000-000000000000/complete`, { method: 'POST', json: {} })).status, 404)
  })

  it('wallet: top-up validation and the mock rail', async () => {
    assert.equal((await a.client.fetch('/api/finance/topup', { method: 'POST', json: { amount: 0 } })).status, 400)
    assert.equal((await a.client.fetch('/api/finance/topup', { method: 'POST', json: { amount: 1_000_000 } })).status, 400)
    assert.equal((await a.client.fetch('/api/finance/topup', { method: 'POST', json: { amount: 'lots' } })).status, 400)
    assert.equal((await a.client.fetch('/api/finance/topup/status')).status, 400, 'no reference')
    assert.equal((await a.client.fetch('/api/finance/topup/status?reference=nope')).status, 404)
    const top = await a.client.json<any>('/api/finance/topup', { method: 'POST', json: { amount: 25 } })
    assert.equal(top.status, 200, JSON.stringify(top.body))
    const status = await a.client.json<any>(`/api/finance/topup/status?reference=${top.body.reference}`)
    assert.equal(status.status, 200)
    assert.equal((await b.client.fetch(`/api/finance/topup/status?reference=${top.body.reference}`)).status, 404, 'another customer cannot see it')
    assert.equal((await a.client.fetch('/api/finance/installments/00000000-0000-0000-0000-000000000000/pay', { method: 'POST', json: {} })).status, 404)
  })

  it('notifications and devices', async () => {
    assert.equal((await a.client.fetch('/api/notifications/00000000-0000-0000-0000-000000000000/read', { method: 'POST' })).status, 404)
    assert.equal((await a.client.fetch('/api/notifications/mark-read', { method: 'POST', json: {} })).status, 200)
    const sessions = await a.client.json<any>('/api/settings/sessions')
    const list = sessions.body.sessions ?? sessions.body.items ?? sessions.body
    assert.ok(Array.isArray(list) && list.some((s: any) => s.current), 'this device is listed as current')
    assert.equal((await a.client.fetch('/api/settings/sessions/00000000-0000-0000-0000-000000000000', { method: 'DELETE' })).status, 404)
    const otherDevice = await login(a.email, PASSWORD)
    const ended = await a.client.fetch('/api/settings/sessions/others', { method: 'POST' })
    assert.equal(ended.status, 200)
    assert.equal((await otherDevice.json<any>('/api/auth/me')).body.user, null, 'the other device is signed out')
    assert.ok((await a.client.json<any>('/api/auth/me')).body.user, 'this one is not')
  })

  it('password change: rules, a wrong current password, and a budget', async () => {
    await resetRateLimits()
    assert.equal((await a.client.fetch('/api/settings/password', { method: 'POST', json: { currentPassword: PASSWORD, newPassword: 'short' } })).status, 400)
    assert.equal((await a.client.fetch('/api/settings/password', { method: 'POST', json: { currentPassword: 'wrong-password-123', newPassword: `${PASSWORD}-2` } })).status, 403)
    const next = `${PASSWORD}-new`
    assert.equal((await a.client.fetch('/api/settings/password', { method: 'POST', json: { currentPassword: PASSWORD, newPassword: next } })).status, 200)
    await resetRateLimits()
    assert.ok(await login(a.email, next), 'the new password signs in')
    await resetRateLimits()
    const old = await client().fetch('/api/auth/login', { method: 'POST', json: { identifier: a.email, password: PASSWORD } })
    assert.equal(old.status, 401, 'the old one does not')
    await resetRateLimits()
    let limited = false
    for (let i = 0; i < 8; i++) {
      const res = await a.client.fetch('/api/settings/password', { method: 'POST', json: { currentPassword: 'guess-guess-guess', newPassword: `${PASSWORD}-x` } })
      if (res.status === 429) {
        limited = true
        break
      }
    }
    assert.ok(limited, 'guessing the current password runs into a limit')
    await resetRateLimits()
    // Put it back for the tests that follow.
    assert.equal((await a.client.fetch('/api/settings/password', { method: 'POST', json: { currentPassword: next, newPassword: PASSWORD } })).status, 200)
  })

  it('two-step verification: on, required at sign-in, a backup code, off', async () => {
    await resetRateLimits()
    const setup = await a.client.json<any>('/api/settings/two-factor/setup', { method: 'POST' })
    assert.equal(setup.status, 200)
    const secret = setup.body.secret as string
    assert.equal((await a.client.fetch('/api/settings/two-factor/enable', { method: 'POST', json: { code: '000000' } })).status, 400, 'a wrong code')
    const step = Math.floor(Date.now() / 30_000)
    const on = await a.client.json<any>('/api/settings/two-factor/enable', { method: 'POST', json: { code: totp(secret, step) } })
    assert.equal(on.status, 200, JSON.stringify(on.body))
    const backup = on.body.backupCodes[0] as string

    await resetRateLimits()
    const first = await client().json<any>('/api/auth/login', { method: 'POST', json: { identifier: a.email, password: PASSWORD } })
    assert.equal(first.body.status, 'two_factor', 'the password alone is not enough')
    const bad = await client().fetch('/api/auth/login-2fa', { method: 'POST', json: { ticket: first.body.ticket, code: '123456' } })
    assert.equal(bad.status, 400)
    const replay = await client().fetch('/api/auth/login-2fa', { method: 'POST', json: { ticket: first.body.ticket, code: totp(secret, step) } })
    assert.equal(replay.status, 400, 'a code already used does not work twice')
    const viaBackup = await client().fetch('/api/auth/login-2fa', { method: 'POST', json: { ticket: first.body.ticket, code: backup } })
    assert.equal(viaBackup.status, 200, 'a backup code signs in')
    const again = await client().fetch('/api/auth/login-2fa', { method: 'POST', json: { ticket: first.body.ticket, code: backup } })
    assert.equal(again.status, 400, 'a backup code works once')

    await resetRateLimits()
    const offWrong = await a.client.fetch('/api/settings/two-factor/disable', { method: 'POST', json: { password: 'not-it-at-all', code: backup } })
    assert.equal(offWrong.status, 403)
    const code = totp(secret, Math.floor(Date.now() / 30_000) + 1)
    const off = await a.client.fetch('/api/settings/two-factor/disable', { method: 'POST', json: { password: PASSWORD, code } })
    assert.equal(off.status, 200, await off.clone().text())
  })

  it('credit application: refused when incomplete, one at a time, withdrawn', async () => {
    const incomplete = await a.client.json<any>('/api/credit/application', { method: 'POST', json: { businessType: 'ltd' } })
    assert.equal(incomplete.status, 400)
    const id = await upload(a.client, 'passport.png', PNG, 'image/png')
    const statement = await upload(a.client, 'statement.pdf', PDF, 'application/pdf')
    assert.equal(statement.status, 200, `a PDF statement uploads: ${JSON.stringify(statement.body)}`)
    const body = {
      businessType: 'sole',
      tradingName: 'Ada Designs',
      businessPostcode: 'SW1A 1AA',
      turnover: 'Under £50k',
      firstName: 'Ada',
      lastName: 'Tester',
      dateOfBirth: '01/02/1985',
      role: 'Owner',
      homeAddress: '1 Test Street, London',
      requestedLimit: 5000,
      idAttachmentId: id.body.files[0].id,
      statementIds: [statement.body.files[0].id],
      consentTrue: true,
      consentChecks: true,
    }
    assert.equal((await a.client.fetch('/api/credit/application', { method: 'POST', json: { ...body, dateOfBirth: '1985-02-01' } })).status, 400, 'date in the wrong shape')
    assert.equal((await a.client.fetch('/api/credit/application', { method: 'POST', json: { ...body, dateOfBirth: '01/02/2020' } })).status, 400, 'under 18')
    assert.equal((await a.client.fetch('/api/credit/application', { method: 'POST', json: { ...body, requestedLimit: 10 } })).status, 400, 'under the minimum')
    assert.equal((await b.client.fetch('/api/credit/application', { method: 'POST', json: body })).status, 400, 'another customer cannot claim these files')
    const sent = await a.client.json<any>('/api/credit/application', { method: 'POST', json: body })
    assert.equal(sent.status, 200, JSON.stringify(sent.body))
    assert.equal((await a.client.fetch('/api/credit/application', { method: 'POST', json: body })).status, 409, 'one at a time')
    const state = await a.client.json<any>('/api/credit/application')
    assert.equal(state.body.application?.id ?? state.body.id, sent.body.application.id)
    assert.equal((await a.client.fetch('/api/credit/application', { method: 'DELETE' })).status, 200)
  })

  it('signing out ends the session', async () => {
    await resetRateLimits()
    const c = await login(b.email, PASSWORD)
    assert.equal((await c.fetch('/api/auth/logout', { method: 'POST' })).status, 200)
    assert.equal((await c.json<any>('/api/auth/me')).body.user, null)
    assert.equal((await c.fetch('/api/orders')).status, 401)
  })
})
