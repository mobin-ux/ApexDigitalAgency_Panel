import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { client, enabled, login, resetRateLimits } from './helpers.ts'

/**
 * The account emails (ADR-022) on a dev server with no mail key: every
 * flow queues its message, and the test reads the link from the queued
 * text through the dev-only capture endpoint instead of the console,
 * which no longer prints it. Signup → verification link → verified;
 * reset request → link → new password → sign in.
 */
interface MailRow {
  id: string
  kind: string
  status: string
  lastError: string | null
  text: string
}

async function mailFor(to: string): Promise<MailRow[]> {
  const res = await client().json<any>(`/api/_test/mail?to=${encodeURIComponent(to)}`)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body.items
}

/**
 * A route that fires its delivery attempt after answering leaves the row
 * QUEUED for a moment; the keyless server then marks it FAILED. Wait for
 * that, briefly, rather than asserting on the race.
 */
async function settled(to: string, kind: string): Promise<MailRow> {
  for (let i = 0; i < 20; i++) {
    const row = (await mailFor(to)).find(r => r.kind === kind)
    if (row && row.status !== 'QUEUED' && row.status !== 'SENDING') {
      return row
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  const row = (await mailFor(to)).find(r => r.kind === kind)
  assert.ok(row, `a ${kind} email was queued for ${to}`)
  return row
}

function linkIn(text: string, path: string): string {
  const match = text.match(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\?token=([^\\s]+)`))
  assert.ok(match, `the message carries a ${path} link:\n${text}`)
  return decodeURIComponent(match![1]!)
}

describe('account emails', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 120_000 }, () => {
  const stamp = Date.now().toString(36)
  const email = `verify-${stamp}@example.test`
  const password = `Signup-${stamp}-pass`
  let customer: Client

  it('signing up with an email queues a verification link that confirms the address once', async () => {
    const res = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: email, password, name: 'Verify Tester' } })
    assert.equal(res.status, 200, await res.text())
    const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
    customer = client(cookie)

    const me = await customer.json<any>('/api/auth/me')
    assert.equal(me.body.user.email, email)
    assert.equal(me.body.user.verifiedAt, null, 'a new account is unverified')

    const verify = await settled(email, 'verify-email')
    assert.equal(verify.status, 'FAILED', 'with no key the row is failed, not pretending to be sent')
    assert.equal(verify.lastError, 'Mail is not configured')
    assert.match(verify.text, /Confirm your email address/)
    const token = linkIn(verify.text, '/auth/verify-email')

    const confirmed = await client().json<any>('/api/auth/verify-email', { method: 'POST', json: { token } })
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body))
    assert.equal(confirmed.body.verified, true)
    assert.equal(confirmed.body.already, false)

    const after = await customer.json<any>('/api/auth/me')
    assert.ok(after.body.user.verifiedAt, 'verifiedAt is set')

    const again = await client().json<any>('/api/auth/verify-email', { method: 'POST', json: { token } })
    assert.equal(again.status, 200, 'a second click is still a success')
    assert.equal(again.body.already, true)

    const noop = await customer.json<any>('/api/auth/verify-email/request', { method: 'POST' })
    assert.equal(noop.status, 200)
    assert.equal(noop.body.verified, true, 'asking again once verified queues nothing')

    const bad = await client().json<any>('/api/auth/verify-email', { method: 'POST', json: { token: 'not-a-token' } })
    assert.equal(bad.status, 400)
  })

  it('a password reset queues a link that sets a new password, and the token is never in the response', async () => {
    await resetRateLimits()
    const asked = await client().json<any>('/api/auth/reset-password-request', { method: 'POST', json: { email } })
    assert.equal(asked.status, 200)
    assert.equal(JSON.stringify(asked.body).includes('token'), false)

    const reset = await settled(email, 'password-reset')
    assert.equal(reset.status, 'FAILED')
    assert.match(reset.text, /expires in 60 minutes/)
    const token = linkIn(reset.text, '/auth/recover')

    const newPassword = `Reset-${stamp}-pass`
    const done = await client().json<any>('/api/auth/reset-password-confirm', { method: 'POST', json: { token, newPassword } })
    assert.equal(done.status, 200, JSON.stringify(done.body))

    await resetRateLimits()
    const signedIn = await login(email, newPassword)
    assert.ok(signedIn.cookie.includes('auth_token='))

    // An unknown address answers identically and queues nothing.
    const unknown = `nobody-${stamp}@example.test`
    const silent = await client().json<any>('/api/auth/reset-password-request', { method: 'POST', json: { email: unknown } })
    assert.equal(silent.status, 200)
    assert.deepEqual(silent.body, asked.body)
    assert.equal((await mailFor(unknown)).length, 0)
  })
})
