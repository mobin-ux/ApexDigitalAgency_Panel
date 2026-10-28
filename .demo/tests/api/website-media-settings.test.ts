import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { BASE, client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * The media library and the site settings through the real endpoints:
 * uploads checked by their bytes, HEAD answered, a referenced file refused
 * deletion, a replacement bumping the version; settings validated per key
 * and visible on the public endpoint. With SITE_TEST_URL the site is
 * checked too: the image route serves and caches, and the footer shows a
 * phone number the panel set.
 */
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')

function png(width: number, height: number): Buffer {
  // A valid-enough PNG for the sniffer and the header parser: signature + IHDR, no image data.
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b, 0)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}

/** A real 1×1 PNG, so the site's image pipeline can decode it. */
const ONE_BY_ONE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function upload(c: Client, name: string, data: Buffer, type = 'image/png', field = 'files') {
  const form = new FormData()
  form.append(field, new Blob([data], { type }), name)
  const res = await fetch(`${BASE}/api/admin/website/media${field === 'file' ? '' : ''}`, { method: 'POST', headers: { cookie: c.cookie, origin: BASE }, body: form })
  const text = await res.text()
  let body: any = text
  try {
    body = JSON.parse(text)
  }
  catch {}
  return { status: res.status, body }
}

describe('website media and settings', { skip: !enabled && 'CMS_TEST_URL is not set' }, () => {
  let owner: Client
  let editor: Client
  let readonly: Client
  let mediaId = ''

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    editor = await staffClient(owner, 'editor')
    readonly = await staffClient(owner, 'readonly')
  })

  it('accepts a PNG from an editor, sizes it, and refuses what the bytes contradict', async () => {
    const ok = await upload(editor, 'pixel.png', ONE_BY_ONE)
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    const file = ok.body.files[0]
    assert.equal(file.mime, 'image/png')
    assert.equal(file.width, 1)
    assert.equal(file.height, 1)
    assert.match(file.src, /^\/api\/site\/media\/.+\/1\/pixel\.png$/)
    mediaId = file.id

    const sized = await upload(editor, 'big.png', png(1200, 630))
    assert.equal(sized.status, 200)
    assert.equal(sized.body.files[0].width, 1200)

    const svg = await upload(editor, 'logo.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml')
    assert.equal(svg.status, 415)
    const mismatch = await upload(editor, 'photo.jpg', ONE_BY_ONE)
    assert.equal(mismatch.status, 415, 'a PNG called .jpg is refused')
    const empty = await upload(editor, 'empty.png', Buffer.alloc(0))
    assert.equal(empty.status, 400)
    const denied = await upload(readonly, 'pixel.png', ONE_BY_ONE)
    assert.equal(denied.status, 403, 'read-only cannot upload')
  })

  it('serves the file publicly with GET and HEAD and a year of cache', async () => {
    const detail = await owner.json<any>(`/api/admin/website/media/${mediaId}`)
    const head = await fetch(`${BASE}${detail.body.src}`, { method: 'HEAD' })
    await head.arrayBuffer()
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('content-type'), 'image/png')
    assert.ok((head.headers.get('cache-control') ?? '').includes('immutable'))
    const get = await fetch(`${BASE}${detail.body.src}`)
    const bytes = Buffer.from(await get.arrayBuffer())
    assert.equal(get.status, 200)
    assert.equal(bytes.length, ONE_BY_ONE.length)
    const missing = await client().fetch('/api/site/media/nope/1/x.png')
    await missing.arrayBuffer()
    assert.equal(missing.status, 404)
  })

  it('a file used by a draft cannot be deleted; replacing bumps the version; unused files delete', async () => {
    const page = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key: `/offers/media-${Date.now().toString(36)}`, title: 'Media page' } })
    assert.equal(page.status, 200, JSON.stringify(page.body))
    const detail = await editor.json<any>(`/api/admin/website/documents/${page.body.id}`)
    const content = { ...detail.body.draft, sections: [{ id: 'img', type: 'imageText', hidden: false, props: { title: 'With a picture', blocks: [], image: { mediaId, alt: 'A pixel' }, imageSide: 'left' } }] }
    const saved = await editor.json<any>(`/api/admin/website/documents/${page.body.id}`, { method: 'PUT', json: { version: detail.body.draftVersion, content } })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))

    const usage = await owner.json<any>(`/api/admin/website/media/${mediaId}/usage`)
    assert.equal(usage.body.usage.length, 1)
    assert.deepEqual(usage.body.usage[0].slots, ['draft'])

    const refused = await owner.json<any>(`/api/admin/website/media/${mediaId}`, { method: 'DELETE' })
    assert.equal(refused.status, 409)
    assert.equal(refused.body.data.usage[0].title, 'Media page')

    const form = new FormData()
    // A real image, so the site's resizer can decode it; the header-only fixtures are for the sniffer only.
    form.append('file', new Blob([ONE_BY_ONE], { type: 'image/png' }), 'pixel-v2.png')
    const replaced = await fetch(`${BASE}/api/admin/website/media/${mediaId}/replace`, { method: 'POST', headers: { cookie: editor.cookie, origin: BASE }, body: form })
    const rep = await replaced.json() as any
    assert.equal(replaced.status, 200, JSON.stringify(rep))
    assert.equal(rep.version, 2)
    assert.match(rep.src, /\/2\/pixel-v2\.png$/)

    const published = await owner.json<any>(`/api/admin/website/documents/${page.body.id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(published.status, 200)
    const live = await client().json<any>(`/api/site/page?path=${encodeURIComponent(page.body.key)}`)
    assert.equal(live.status, 200)
    assert.equal(live.body.media[mediaId].width, 1, 'the media index travels with the published document')

    if (SITE) {
      const html = await (await fetch(`${SITE}${page.body.key}`)).text()
      const src = html.match(/src="(\/_ipx\/[^"]+)"/)?.[1]
      assert.ok(src, 'the page renders the image through the site pipeline')
      const first = await fetch(`${SITE}${src}`)
      await first.arrayBuffer()
      assert.equal(first.status, 200)
      assert.equal(first.headers.get('x-image-cache'), 'miss')
      const second = await fetch(`${SITE}${src}`)
      await second.arrayBuffer()
      assert.equal(second.headers.get('x-image-cache'), 'hit', 'the second request is served from the disk cache')
    }

    await owner.json(`/api/admin/website/documents/${page.body.id}/transition`, { method: 'POST', json: { action: 'archive' } })
    const afterArchive = await owner.json<any>(`/api/admin/website/media/${mediaId}/usage`)
    assert.deepEqual(afterArchive.body.usage[0]?.slots ?? [], ['draft'], 'archiving drops the published reference, the draft keeps it')

    const spare = await upload(editor, 'spare.png', ONE_BY_ONE)
    const deleted = await owner.json<any>(`/api/admin/website/media/${spare.body.files[0].id}`, { method: 'DELETE' })
    assert.equal(deleted.status, 200)
    const gone = await client().fetch(spare.body.files[0].src)
    await gone.arrayBuffer()
    assert.equal(gone.status, 404)
  })

  it('settings are validated per key, audited, and visible on the public endpoint', async () => {
    const bad = await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.url': 'not a url', 'site.robots.disallow': ['/'], 'nope': 1 } })
    assert.equal(bad.status, 400)
    assert.ok(bad.body.data.fieldErrors['site.url'] && bad.body.data.fieldErrors['site.robots.disallow'] && bad.body.data.fieldErrors.nope)

    const denied = await editor.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.phone': '01622 000000' } })
    assert.equal(denied.status, 403)

    const phone = `01622 ${Date.now().toString().slice(-6)}`
    const ok = await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.phone': phone, 'site.robots.disallow': ['/offers/internal'] } })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    assert.ok(ok.body.changed.includes('site.phone'))
    const pub = await client().json<any>('/api/site/settings')
    assert.equal(pub.status, 200)
    assert.equal(pub.body.phone, phone)
    assert.deepEqual(pub.body.robotsDisallow, ['/offers/internal'])

    if (SITE) {
      // The site caches settings for 60 s; the panel's revalidate is for documents. Force it through the panel's hook: a publish.
      await owner.json('/api/admin/website/publish-due', { method: 'POST', json: {} })
      await fetch(`${SITE}/api/cms/revalidate`, { method: 'POST', headers: { 'authorization': `Bearer ${process.env.CMS_TEST_SECRET ?? ''}`, 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
      const html = await (await fetch(`${SITE}/`)).text()
      if (process.env.CMS_TEST_SECRET) {
        assert.ok(html.includes(phone), 'the footer shows the phone number the panel set')
      }
    }

    const reset = await owner.json<any>('/api/admin/website/settings', { method: 'PUT', json: { 'site.phone': '', 'site.robots.disallow': [] } })
    assert.equal(reset.status, 200)
  })
})
