/* eslint-disable test/no-import-node-test -- Node's own runner, no framework */
import assert from 'node:assert/strict'
import process from 'node:process'
import { describe, it } from 'node:test'

/**
 * The public site's own server, from outside (ADR-018, ADR-026): the
 * contact form's guards, the visit beacon, the revalidate hook, the media
 * pass-through, preview links, robots and the sitemap, and that every
 * answer names its request. Needs `SITE_TEST_URL` (the site's dev server).
 * Nothing here sends a real message: the contact checks stop at validation.
 */

const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')

function site(path: string, init?: RequestInit & { json?: unknown }) {
  const headers = new Headers(init?.headers)
  if (init?.json !== undefined) {
    headers.set('content-type', 'application/json')
  }
  return fetch(`${SITE}${path}`, { ...init, headers, body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body, redirect: 'manual' })
}

describe('public site', { skip: !SITE && 'SITE_TEST_URL is not set' }, () => {
  it('pages answer and name their request', async () => {
    for (const path of ['/', '/services', '/services/seo', '/our-work', '/insights', '/about', '/contact']) {
      const res = await site(path, { headers: { accept: 'text/html' } })
      assert.equal(res.status, 200, path)
      assert.match(res.headers.get('x-request-id') ?? '', /^[\w-]{8,64}$/, `${path} has a request id`)
    }
    assert.equal((await site('/no-such-page-anywhere', { headers: { accept: 'text/html' } })).status, 404)
    assert.equal((await site('/robots.txt')).status, 200)
    assert.equal((await site('/sitemap.xml')).status, 200)
  })

  it('no link on the site leads to a page that is not there (AUD-01)', { timeout: 180_000 }, async () => {
    const status = new Map<string, number>()
    const linkedFrom = new Map<string, string>()
    const queue = ['/']
    while (queue.length) {
      const path = queue.shift()!
      if (status.has(path)) {
        continue
      }
      const res = await site(path, { headers: { accept: 'text/html' } })
      status.set(path, res.status)
      if (res.status !== 200 || !(res.headers.get('content-type') ?? '').includes('html')) {
        continue
      }
      for (const [, href] of (await res.text()).matchAll(/href="(\/[^"#?]*)/g)) {
        const target = href || '/'
        // Assets and API calls are not pages.
        if (/^\/(?:_nuxt|_ipx|brand|fonts|img|icons|media|api)\b/.test(target) || /\.\w{2,4}$/.test(target)) {
          continue
        }
        if (!status.has(target) && !queue.includes(target)) {
          linkedFrom.set(target, path)
          queue.push(target)
        }
      }
    }
    const broken = [...status].filter(([, code]) => code !== 200).map(([path, code]) => `${code} ${path} (linked from ${linkedFrom.get(path)})`)
    assert.ok(status.size > 20, `crawled ${status.size} pages`)
    assert.deepEqual(broken, [])
  })

  it('the contact form refuses what it should', async () => {
    const sameOrigin = { 'sec-fetch-site': 'same-origin', 'origin': SITE }
    assert.equal((await site('/api/contact')).status, 405, 'GET is not allowed')
    const empty = await site('/api/contact', { method: 'POST', json: {}, headers: sameOrigin })
    assert.equal(empty.status, 422, 'an empty message')
    const body = await empty.json()
    assert.ok(body.data?.errors, 'the fields to fix are named')
    const cross = await site('/api/contact', { method: 'POST', json: { name: 'x' }, headers: { 'sec-fetch-site': 'cross-site', 'origin': 'https://evil.example' } })
    assert.ok(cross.status === 403 || cross.status === 400, `a cross-site post is refused (got ${cross.status})`)
    const big = await site('/api/contact', { method: 'POST', body: JSON.stringify({ message: 'x'.repeat(40_000) }), headers: { ...sameOrigin, 'content-type': 'application/json' } })
    assert.equal(big.status, 413, 'a body over the cap')
    const form = await site('/api/contact', { method: 'POST', body: 'name=x', headers: { ...sameOrigin, 'content-type': 'application/x-www-form-urlencoded' } })
    assert.ok(form.status >= 400 && form.status < 500, `a form post is refused (got ${form.status})`)
  })

  it('the visit beacon always answers 204 and ignores what it should', async () => {
    assert.equal((await site('/api/hit', { method: 'POST', json: { p: '/' } })).status, 204, 'no fetch metadata')
    assert.equal((await site('/api/hit', { method: 'POST', json: { p: '/', e: 1 }, headers: { 'sec-fetch-site': 'same-origin', 'user-agent': 'Googlebot/2.1' } })).status, 204, 'a bot')
    assert.equal((await site('/api/hit')).status, 405, 'GET is not allowed')
  })

  // Known issue, kept visible rather than fixed (docs/audit/ISSUES-2026-11-02.md, AUD-12).
  it('the visit beacon answers 204 to a malformed body', { todo: 'AUD-12: answers 400 "Invalid JSON body"' }, async () => {
    assert.equal((await site('/api/hit', { method: 'POST', body: 'garbage', headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' } })).status, 204)
  })

  it('the revalidate hook needs the bearer', async () => {
    const none = await site('/api/cms/revalidate', { method: 'POST', json: {} })
    assert.ok(none.status === 401 || none.status === 503, `no bearer (got ${none.status})`)
    const wrong = await site('/api/cms/revalidate', { method: 'POST', json: {}, headers: { authorization: 'Bearer not-the-secret' } })
    assert.ok(wrong.status === 401 || wrong.status === 503, `a wrong bearer (got ${wrong.status})`)
  })

  it('media and preview addresses cannot be walked out of', async () => {
    for (const path of ['/media/..%2F..%2F.env', '/media/../../package.json', '/media/x/y', '/media/%00']) {
      const res = await site(path)
      assert.ok(res.status === 404 || res.status === 400, `${path} answered ${res.status}`)
      const text = await res.text()
      assert.ok(!/NUXT_|"name":\s*"@apex/.test(text), `${path} leaked a file`)
    }
    assert.equal((await site('/preview/not-a-real-token', { headers: { accept: 'text/html' } })).status, 404)
  })
})
