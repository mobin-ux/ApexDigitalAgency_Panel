import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { after, before, describe, it } from 'node:test'
import { BASE, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * Phase D of the Website group (ADR-026), over HTTP: the media library
 * (uploads checked by their bytes, alt text, usage, delete refused while a
 * page uses a file), redirects (permission, loops, the site answering
 * them), Site settings (per-key permission and validation, the site
 * printing them), robots.txt additions, maintenance mode, and menus being
 * Owner/Admin work. With SITE_TEST_URL the site is checked after each step.
 *
 * Local database only. Every setting it changes is put back in `after`.
 */
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')
const run = Date.now().toString(36)

/** A real 1×1 PNG. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function upload(c: Client, name: string, data: Buffer, type = 'image/png') {
  const form = new FormData()
  form.append('files', new Blob([data], { type }), name)
  const res = await fetch(`${BASE}/api/admin/website/media`, { method: 'POST', headers: { cookie: c.cookie, origin: BASE }, body: form })
  const text = await res.text()
  try {
    return { status: res.status, body: JSON.parse(text) }
  }
  catch {
    return { status: res.status, body: text as any }
  }
}

async function siteHtml(path: string): Promise<{ status: number, html: string, location: string | null }> {
  // As a browser asks: without it an error page is answered as JSON.
  const res = await fetch(`${SITE}${path}`, { redirect: 'manual', headers: { accept: 'text/html' } })
  return { status: res.status, html: await res.text(), location: res.headers.get('location') }
}

/** The site's cache is purged by the console; poll briefly for the change to show. */
async function eventually(check: () => Promise<boolean>): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    if (await check()) {
      return true
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

describe('website structure: media, redirects, settings', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 300_000 }, () => {
  let owner: Client
  let pm: Client
  let support: Client
  let finance: Client
  let original: Record<string, unknown> = {}

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    pm = await staffClient(owner, 'pm')
    support = await staffClient(owner, 'support')
    finance = await staffClient(owner, 'finance')
    original = (await owner.json<any>('/api/admin/website/settings')).body.values
  })

  after(async () => {
    const keys = ['site.phone', 'site.maintenance', 'site.robots.disallow', 'site.companyNumber']
    await owner.json('/api/admin/website/settings', { method: 'PUT', json: Object.fromEntries(keys.map(k => [k, original[k]])) })
  })

  it('takes uploads by their bytes, and keeps a file a page uses', async () => {
    const ok = await upload(pm, `pixel-${run}.png`, PIXEL)
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    const id = ok.body.files[0].id
    assert.equal((await upload(pm, 'logo.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')).status, 415, 'SVG can carry script')
    assert.equal((await upload(pm, 'photo.jpg', PIXEL)).status, 415, 'a PNG called .jpg is refused')
    assert.equal((await upload(pm, 'empty.png', Buffer.alloc(0))).status, 400)
    assert.equal((await upload(finance, 'pixel.png', PIXEL)).status, 403, 'finance can look, not upload')

    const listed = await finance.json<any>('/api/admin/website/media?filter=noalt&pageSize=100')
    const file = listed.body.items.find((m: any) => m.id === id)
    assert.ok(file, 'a new image is listed under Missing alt text')
    assert.equal(file.width, 1)
    const served = await fetch(`${BASE}${file.src}`)
    assert.equal(served.status, 200)
    assert.equal(served.headers.get('content-type'), 'image/png')
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await fetch(`${BASE}${file.src}`, { method: 'HEAD' })).status, 200)

    assert.equal((await pm.json<any>(`/api/admin/website/media/${id}`, { method: 'PATCH', json: { alt: 'A single violet pixel' } })).status, 200)

    // Used on a built page, it cannot be deleted.
    const page = await pm.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-page', title: `Pictures ${run}`, path: `/pictures-${run}` } })
    const docId = page.body.document.id
    const detail = (await pm.json<any>(`/api/admin/website/documents/${docId}`)).body
    const content = { ...detail.draft, sections: [...detail.draft.sections, { id: 'pic', type: 'image', hidden: false, fields: { media: id, caption: 'The pixel' } }] }
    assert.equal((await pm.json<any>(`/api/admin/website/documents/${docId}/draft`, { method: 'PUT', json: { content, version: detail.draftVersion } })).status, 200)
    const used = (await pm.json<any>('/api/admin/website/media?pageSize=100')).body.items.find((m: any) => m.id === id)
    assert.deepEqual(used.used.map((d: any) => d.path), [`/pictures-${run}`])
    const refused = await pm.json<any>(`/api/admin/website/media/${id}`, { method: 'DELETE' })
    assert.equal(refused.status, 409, 'a file a page uses stays')

    if (SITE) {
      const fresh = (await owner.json<any>(`/api/admin/website/documents/${docId}`)).body
      assert.equal((await owner.json<any>(`/api/admin/website/documents/${docId}/publish`, { method: 'POST', json: { version: fresh.draftVersion } })).status, 200)
      assert.ok(await eventually(async () => (await siteHtml(`/pictures-${run}`)).html.includes('A single violet pixel')), 'the page shows the image with its alt text')
      const live = await siteHtml(`/pictures-${run}`)
      const src = /<img[^>]+src="(\/media\/[^"]+)"/.exec(live.html)?.[1]
      assert.ok(src, 'the image is served by the site itself')
      const img = await fetch(`${SITE}${src}`)
      assert.equal(img.status, 200)
      assert.equal(img.headers.get('content-type'), 'image/png')
    }
  })

  it('redirects are Owner/Admin work, refuse loops, and the site follows them', async () => {
    const from = `/old-${run}`
    assert.equal((await support.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: from, toPath: '/about' } })).status, 403)
    assert.equal((await owner.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: 'javascript:alert(1)', toPath: '/about' } })).status, 400)
    const made = await owner.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: from, toPath: '/about', statusCode: 301 } })
    assert.equal(made.status, 200, JSON.stringify(made.body))
    const loop = await owner.json<any>('/api/admin/website/redirects/check', { method: 'POST', json: { fromPath: '/about', toPath: from } })
    assert.equal(loop.body.ok, false, 'pointing back would loop')
    assert.ok((await owner.json<any>('/api/site/redirects')).body.redirects.some((r: any) => r.from === from))

    if (SITE) {
      assert.ok(await eventually(async () => {
        const res = await siteHtml(`${from}?ref=test`)
        return res.status === 301 && res.location === '/about?ref=test'
      }), 'the site answers the redirect, keeping the query')
    }
    assert.equal((await owner.json<any>(`/api/admin/website/redirects/${made.body.redirect.id}`, { method: 'DELETE' })).status, 200)
    if (SITE) {
      assert.ok(await eventually(async () => (await siteHtml(from)).status === 404), 'removed: the old address is a 404 again')
    }
  })

  it('Site settings are Owner-only and validated; the site prints them', async () => {
    const phone = '01622 555 0101'
    assert.equal((await pm.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.phone': phone } })).status, 403)
    const bad = await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.companyNumber': '123' } })
    assert.equal(bad.status, 400)
    assert.ok(bad.body.data.fieldErrors['site.companyNumber'])
    assert.equal((await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.unknown': 'x' } })).status, 400)
    const ok = await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.phone': phone } })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    assert.equal((await owner.json<any>('/api/site/settings')).body.phone, phone)
    if (SITE) {
      assert.ok(await eventually(async () => (await siteHtml('/contact')).html.includes(phone)), 'the site shows the phone number')
    }
  })

  it('robots.txt additions belong to SEO & redirects, and reach the site', async () => {
    assert.equal((await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.robots.disallow': ['/'] } })).status, 400, 'the whole site cannot be hidden')
    assert.equal((await support.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.robots.disallow': ['/x'] } })).status, 403)
    assert.equal((await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.robots.disallow': [`/hidden-${run}`] } })).status, 200)
    if (SITE) {
      assert.ok(await eventually(async () => (await siteHtml('/robots.txt?mockProductionEnv')).html.includes(`Disallow: /hidden-${run}`)))
    }
    const seo = await finance.json<any>('/api/admin/website/seo')
    assert.equal(seo.status, 200)
    assert.ok(Array.isArray(seo.body.rows))
    assert.equal(typeof seo.body.sitemap.listed, 'number')
  })

  it('maintenance mode holds every page and the contact form, and lifts', { skip: !SITE && 'SITE_TEST_URL is not set' }, async () => {
    assert.equal((await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.maintenance': true } })).status, 200)
    try {
      assert.ok(await eventually(async () => (await siteHtml('/about')).status === 503), 'pages answer 503')
      const held = await siteHtml('/')
      assert.ok(held.html.includes('We are making some changes'))
      const contact = await fetch(`${SITE}/api/contact`, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: '{}' })
      assert.equal(contact.status, 503, 'the form takes no enquiries')
    }
    finally {
      await owner.json('/api/admin/website/settings', { method: 'PUT', json: { 'site.maintenance': false } })
    }
    assert.ok(await eventually(async () => (await siteHtml('/about')).status === 200), 'pages come back')
  })

  it('menus and the footer are changed by Owner or Admin only', async () => {
    const chrome = await pm.json<any>('/api/admin/website/documents?collection=chrome&pageSize=50')
    const header = chrome.body.items.find((d: any) => d.template === 'header')
    if (!header) {
      return
    }
    const detail = (await pm.json<any>(`/api/admin/website/documents/${header.id}`)).body
    const denied = await pm.json<any>(`/api/admin/website/documents/${header.id}/draft`, { method: 'PUT', json: { content: detail.draft, version: detail.draftVersion } })
    assert.equal(denied.status, 403)
    assert.equal(denied.body.data?.permission, 'website.seo')
  })
})
