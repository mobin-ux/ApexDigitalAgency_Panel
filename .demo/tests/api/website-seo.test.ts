import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { BASE, client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * Redirects, the SEO audit and the head the site renders, through the real
 * endpoints: a loop refused, a chain flattened, a published page's own
 * robots and canonical on the public document, the audit naming what it
 * found. With SITE_TEST_URL the site is checked too: the redirect
 * middleware answers 301/302 with the location, the sitemap lists the
 * published landing page and leaves the hidden one out, robots.txt carries
 * the configured disallow, a noindex page sends X-Robots-Tag, and the
 * preview route is no-store.
 */
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')

describe('website SEO and redirects', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 120_000 }, () => {
  let owner: Client
  let editor: Client
  let publisher: Client
  const stamp = Date.now().toString(36)
  const from = `/old-${stamp}`
  let redirectId = ''

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    editor = await staffClient(owner, 'editor')
    publisher = await staffClient(owner, 'publisher')
  })

  it('a publisher may add a redirect, an editor may not; bad addresses are 400, a loop is 409, a chain is flattened', async () => {
    const denied = await editor.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: from, toPath: '/services' } })
    assert.equal(denied.status, 403)

    const bad = await publisher.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: 'javascript:alert(1)', toPath: '/services' } })
    assert.equal(bad.status, 400)
    assert.ok(bad.body.data.fieldErrors.fromPath)
    const self = await publisher.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: from, toPath: from } })
    assert.equal(self.status, 409)

    const created = await publisher.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: `${from}/`, toPath: '/services/website-design', note: 'test' } })
    assert.equal(created.status, 200, JSON.stringify(created.body))
    assert.equal(created.body.redirect.fromPath, from, 'the address is normalised')
    assert.equal(created.body.redirect.statusCode, 301)
    redirectId = created.body.redirect.id

    const loop = await publisher.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: '/services/website-design', toPath: from } })
    assert.equal(loop.status, 409, 'A → B while B → A is refused')

    const chain = await publisher.json<any>('/api/admin/website/redirects/check', { method: 'POST', json: { fromPath: `/older-${stamp}`, toPath: from } })
    assert.equal(chain.status, 200)
    assert.equal(chain.body.toPath, '/services/website-design', 'pointing at a redirected address points straight at its destination')
    assert.ok(chain.body.warnings.length >= 1)

    const dup = await publisher.json<any>('/api/admin/website/redirects', { method: 'POST', json: { fromPath: from, toPath: '/about' } })
    assert.equal(dup.status, 409)

    const pubRes = await client().fetch('/api/site/redirects')
    const pub = await pubRes.json() as any
    assert.equal(pubRes.status, 200)
    assert.ok(pub.redirects.some((r: any) => r.from === from && r.to === '/services/website-design' && r.status === 301))
    assert.ok((pubRes.headers.get('cache-control') ?? '').includes('public'))
  })

  it('a hidden page carries its robots setting on the public document; the audit reports it and a missing description', async () => {
    const key = `/offers/seo-${stamp}`
    const page = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key, title: 'SEO page' } })
    assert.equal(page.status, 200)
    const detail = await editor.json<any>(`/api/admin/website/documents/${page.body.id}`)
    const content = { ...detail.body.draft, seo: { ...detail.body.draft.seo, title: 'A hidden offer', description: '', robots: 'noindex,follow', canonical: '/services' }, sections: [{ id: 'b', type: 'banner', hidden: false, props: { text: 'Hidden', tone: 'info' } }] }
    const saved = await editor.json<any>(`/api/admin/website/documents/${page.body.id}`, { method: 'PUT', json: { version: detail.body.draftVersion, content } })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    const published = await publisher.json<any>(`/api/admin/website/documents/${page.body.id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(published.status, 200)

    const live = await client().json<any>(`/api/site/page?path=${encodeURIComponent(key)}`)
    assert.equal(live.body.content.seo.robots, 'noindex,follow')
    assert.equal(live.body.content.seo.canonical, '/services')
    const manifest = await client().json<any>('/api/site/manifest')
    const entry = manifest.body.pages.find((p: any) => p.key === key)
    assert.ok(entry?.noindex, 'the manifest marks the page hidden, so the sitemap leaves it out')

    const audit = await publisher.json<any>('/api/admin/website/seo-audit')
    assert.equal(audit.status, 200)
    assert.ok(audit.body.issues.some((i: any) => i.kind === 'noindex' && i.key === key))
    assert.ok(audit.body.issues.some((i: any) => i.kind === 'description-missing' && i.key === key))
    const auditDenied = await editor.json<any>('/api/admin/website/seo-audit')
    assert.equal(auditDenied.status, 403)

    if (SITE) {
      await fetch(`${SITE}/api/cms/revalidate`, { method: 'POST', headers: { 'authorization': `Bearer ${process.env.CMS_TEST_SECRET ?? ''}`, 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
      const res = await fetch(`${SITE}${key}`)
      const html = await res.text()
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow', 'a hidden page says so in a header too')
      assert.match(html, /<meta name="robots" content="noindex, follow">/)
      assert.match(html, /<title>A hidden offer/)
      const canonical = html.match(/<link[^>]*rel="canonical"[^>]*>/g) ?? []
      assert.equal(canonical.length, 1, `one canonical link: ${canonical.join(' ')}`)
      assert.match(canonical[0]!, /href="[^"]+\/services"/, 'the page-level canonical wins over the module default')

      const moved = await fetch(`${SITE}${from}?utm=1`, { redirect: 'manual' })
      await moved.arrayBuffer()
      assert.equal(moved.status, 301)
      assert.equal(moved.headers.get('location'), '/services/website-design?utm=1', 'the query string survives')

      const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text()
      assert.ok(!sitemap.includes(key), 'a noindex page is not in the sitemap')
      assert.ok(sitemap.includes('/services/website-design'), 'code pages are listed')
      assert.ok(!sitemap.includes('/preview/'), 'previews never are')

      // In development the robots module blocks everything; the query asks it to answer as production would.
      const robots = await (await fetch(`${SITE}/robots.txt?mockProductionEnv`)).text()
      assert.match(robots, /Disallow: \/preview\//)
      assert.match(robots, /Sitemap: /)
    }

    await publisher.json(`/api/admin/website/documents/${page.body.id}/transition`, { method: 'POST', json: { action: 'archive' } })
  })

  it('a redirect can be switched to temporary, turned off and removed; a removed one no longer answers', async () => {
    const patched = await publisher.json<any>(`/api/admin/website/redirects/${redirectId}`, { method: 'PATCH', json: { statusCode: 302 } })
    assert.equal(patched.status, 200, JSON.stringify(patched.body))
    assert.equal(patched.body.redirect.statusCode, 302)
    if (SITE) {
      await fetch(`${SITE}/api/cms/revalidate`, { method: 'POST', headers: { 'authorization': `Bearer ${process.env.CMS_TEST_SECRET ?? ''}`, 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
      const res = await fetch(`${SITE}${from}`, { redirect: 'manual' })
      await res.arrayBuffer()
      assert.equal(res.status, 302)
    }
    const off = await publisher.json<any>(`/api/admin/website/redirects/${redirectId}`, { method: 'PATCH', json: { enabled: false } })
    assert.equal(off.body.redirect.enabled, false)
    const pub = await client().json<any>('/api/site/redirects')
    assert.ok(!pub.body.redirects.some((r: any) => r.from === from), 'a disabled redirect is not served')

    const removed = await publisher.json<any>(`/api/admin/website/redirects/${redirectId}`, { method: 'DELETE' })
    assert.equal(removed.status, 200)
    const gone = await publisher.json<any>(`/api/admin/website/redirects/${redirectId}`, { method: 'DELETE' })
    assert.equal(gone.status, 404)
    if (SITE) {
      await fetch(`${SITE}/api/cms/revalidate`, { method: 'POST', headers: { 'authorization': `Bearer ${process.env.CMS_TEST_SECRET ?? ''}`, 'content-type': 'application/json' }, body: '{}' }).catch(() => {})
      const res = await fetch(`${SITE}${from}`, { redirect: 'manual' })
      await res.arrayBuffer()
      assert.equal(res.status, 404, 'with the redirect gone the address is an ordinary 404')
      const preview = await fetch(`${SITE}/preview/not-a-token`)
      await preview.arrayBuffer()
      assert.equal(preview.status, 404, 'a bad token is a 404, not a page titled "Preview: undefined"')
      // The error page carries Nitro's own no-cache; a rendered preview carries the route rule's no-store. Neither is cacheable.
      assert.match(preview.headers.get('cache-control') ?? '', /no-(store|cache)/)
      assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow')
    }
  })

  it('the public redirect endpoint needs no auth and the admin one does', async () => {
    const anon = await client().fetch('/api/admin/website/redirects')
    await anon.arrayBuffer()
    assert.equal(anon.status, 401)
    const pub = await client().fetch('/api/site/redirects')
    await pub.arrayBuffer()
    assert.equal(pub.status, 200)
    assert.equal(pub.headers.get('pragma'), null)
    assert.ok(BASE)
  })
})
