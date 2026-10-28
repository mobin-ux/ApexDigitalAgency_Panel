import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * A page's life through the real endpoints: create → invalid save 400 →
 * save → stale save 409 → preview token → publish → the public content API
 * serves it → edit → restore → unpublish → delete refused → archive. With
 * `SITE_TEST_URL` set as well, the site is checked at each step (draft not
 * visible, preview renders, publish visible on the next request, 404 after
 * unpublish, two responses carry different CSP nonces).
 */
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')

describe('website document lifecycle', { skip: !enabled && 'CMS_TEST_URL is not set' }, () => {
  let owner: Client
  let editor: Client
  let id = ''
  let version = 0
  const key = `/offers/test-${Date.now().toString(36)}`
  const marker = `Lifecycle ${Date.now().toString(36)}`

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    editor = await staffClient(owner, 'editor')
  })

  it('an editor creates a landing page as a draft', async () => {
    const res = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key, title: 'Lifecycle page' } })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.state, 'draft')
    assert.equal(res.body.key, key)
    id = res.body.id
    const detail = await editor.json<any>(`/api/admin/website/documents/${id}`)
    version = detail.body.draftVersion
    assert.deepEqual(detail.body.actions, ['submit', 'publish', 'schedule', 'archive', 'delete'])
  })

  it('refuses a reserved address and a bad path', async () => {
    const reserved = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key: '/about', title: 'Clash' } })
    assert.equal(reserved.status, 409)
    const bad = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key: '/a/../b', title: 'Bad' } })
    assert.equal(bad.status, 400)
  })

  it('refuses invalid content with field paths and accepts a valid draft', async () => {
    const bad = await editor.json<any>(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version, content: { title: 'Lifecycle page', sections: [{ id: 'x', type: 'carousel', hidden: false, props: {} }], seo: {} } } })
    assert.equal(bad.status, 400)
    assert.ok(Object.keys(bad.body.data.fieldErrors).some(k => k.startsWith('sections')), JSON.stringify(bad.body.data))

    const content = {
      title: 'Lifecycle page',
      sections: [{ id: 'hero-1', type: 'hero', hidden: false, props: { eyebrow: '', title: marker, text: 'From the test suite.', primary: { label: 'Talk to us', link: { kind: 'internal', path: '/contact' } } } }],
      seo: { title: '', description: '', canonical: '', robots: 'index,follow', ogTitle: '', ogDescription: '' },
    }
    const ok = await editor.json<any>(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version, content, note: 'first words' } })
    assert.equal(ok.status, 200, JSON.stringify(ok.body))
    assert.equal(ok.body.draftVersion, version + 1)
    const stale = await editor.json<any>(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version, content } })
    assert.equal(stale.status, 409)
    assert.equal(stale.body.data.currentVersion, version + 1)
    version = ok.body.draftVersion
  })

  it('an editor cannot publish; a publisher-level role can', async () => {
    const refused = await editor.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(refused.status, 403)
    assert.equal(refused.body.data.permission, 'website.publish')

    if (SITE) {
      const before = await fetch(`${SITE}${key}`)
      await before.arrayBuffer()
      assert.equal(before.status, 404, 'a draft is not on the site')
      const link = await editor.json<any>(`/api/admin/website/documents/${id}/preview-link`, { method: 'POST', json: {} })
      assert.equal(link.status, 200)
      if (link.body.url) {
        const preview = await fetch(link.body.url)
        const html = await preview.text()
        assert.equal(preview.status, 200)
        assert.ok(html.includes(marker) && html.includes('Draft preview'), 'the site renders the draft behind the token')
      }
    }

    const published = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(published.status, 200, JSON.stringify(published.body))
    assert.equal(published.body.state, 'published')
    assert.equal(published.body.published.number, 2)
  })

  it('the public content API serves only the published revision, cacheable', async () => {
    const res = await client().fetch(`/api/site/page?path=${encodeURIComponent(key)}`)
    const body = await res.json() as any
    assert.equal(res.status, 200)
    assert.equal(body.template, 'landing')
    assert.equal(body.content.sections[0].props.title, marker)
    assert.ok((res.headers.get('cache-control') ?? '').includes('public'))
    assert.equal(res.headers.get('pragma'), null)
    const missing = await client().fetch('/api/site/page?path=/nothing-here')
    await missing.arrayBuffer()
    assert.equal(missing.status, 404)

    if (SITE) {
      const live = await fetch(`${SITE}${key}`)
      const html = await live.text()
      assert.equal(live.status, 200)
      assert.ok(html.includes(marker), 'the site shows the published page on the next request')
      const again = await (await fetch(`${SITE}${key}`)).text()
      const nonce = (s: string) => s.match(/nonce="([^"]+)"/)?.[1]
      assert.ok(nonce(html) && nonce(html) !== nonce(again), 'every response carries its own CSP nonce')
    }
  })

  it('a later save shows as draft changes; restoring the live revision makes the draft match it again', async () => {
    const detail = await editor.json<any>(`/api/admin/website/documents/${id}`)
    const content = { ...detail.body.draft, title: 'Lifecycle page, edited' }
    const saved = await editor.json<any>(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version: detail.body.draftVersion, content } })
    assert.equal(saved.body.state, 'published_changes')
    const restored = await editor.json<any>(`/api/admin/website/documents/${id}/revisions/2/restore`, { method: 'POST', json: {} })
    assert.equal(restored.status, 200)
    assert.ok(restored.body.revisions.length >= 4)
    assert.equal(restored.body.state, 'published', 'the restored draft is what is live')
    const noop = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(noop.status, 409, 'nothing new to publish')
  })

  it('unpublish takes it off the site; delete is refused; archive works', async () => {
    const un = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'unpublish' } })
    assert.equal(un.status, 200)
    assert.equal(un.body.state, 'draft')
    if (SITE) {
      const gone = await fetch(`${SITE}${key}`)
      await gone.arrayBuffer()
      assert.equal(gone.status, 404)
    }
    const del = await owner.json<any>(`/api/admin/website/documents/${id}`, { method: 'DELETE' })
    assert.equal(del.status, 409)
    const archived = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'archive' } })
    assert.equal(archived.body.state, 'archived')
    const edit = await editor.json<any>(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version: archived.body.draftVersion, content: {} } })
    assert.equal(edit.status, 409, 'an archived document cannot be edited')
  })

  it('a never-published draft can be deleted', async () => {
    const res = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key: `${key}-tmp`, title: 'Temporary' } })
    const del = await owner.json<any>(`/api/admin/website/documents/${res.body.id}`, { method: 'DELETE' })
    assert.equal(del.status, 200)
    const gone = await owner.json<any>(`/api/admin/website/documents/${res.body.id}`)
    assert.equal(gone.status, 404)
  })
})
