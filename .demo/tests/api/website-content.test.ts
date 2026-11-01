import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * The Website screens' content loop (ADR-026, phase B), over HTTP: import
 * the site's pages, save a draft without changing the live site, publish,
 * review (submit, request changes, approve), restore a revision, preview a
 * draft, and the permission edges of each step. With `SITE_TEST_URL` set
 * (the site's dev server, paired with this panel) it also checks what the
 * site renders after each publish.
 *
 * Local database only: it publishes to the pages it imports and leaves the
 * built test documents behind.
 */

const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')
const run = Date.now().toString(36)

async function siteHtml(path: string): Promise<{ status: number, html: string }> {
  const res = await fetch(`${SITE}${path}`, { redirect: 'manual' })
  return { status: res.status, html: await res.text() }
}

/** The site may cache for up to its 60 s window when revalidation is not paired; poll briefly. */
async function siteShows(path: string, text: string, want = true): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    const { html } = await siteHtml(path)
    if (html.includes(text) === want) {
      return true
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function documentAt(actor: Client, collection: string, path: string) {
  const list = await actor.json<any>(`/api/admin/website/documents?collection=${collection}&pageSize=100`)
  assert.equal(list.status, 200, JSON.stringify(list.body).slice(0, 300))
  return list.body.items.find((d: any) => d.path === path)
}

describe('website content loop', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 300_000 }, () => {
  let owner: Client
  let pm: Client
  let support: Client
  let finance: Client

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    pm = await staffClient(owner, 'pm')
    support = await staffClient(owner, 'support')
    finance = await staffClient(owner, 'finance')
  })

  it('imports the site\'s pages as published documents, once', { skip: !SITE && 'SITE_TEST_URL is not set' }, async () => {
    const first = await owner.json<any>('/api/admin/website/import', { method: 'POST', json: {} })
    assert.equal(first.status, 200, JSON.stringify(first.body).slice(0, 300))
    assert.deepEqual(first.body.skipped, [])
    const again = await owner.json<any>('/api/admin/website/import', { method: 'POST', json: {} })
    assert.equal(again.body.created, 0, 'a second import adds nothing')
    const about = await documentAt(owner, 'pages', '/about')
    assert.ok(about, 'the About page is a document')
    assert.equal(about.status, 'PUBLISHED')
    assert.equal(about.dirty, false)
    assert.equal((await pm.json<any>('/api/admin/website/import', { method: 'POST', json: {} })).status, 403, 'a project manager cannot import')
  })

  it('a saved draft leaves the live page alone; publishing puts it live', { skip: !SITE && 'SITE_TEST_URL is not set' }, async () => {
    const about = await documentAt(owner, 'pages', '/about')
    const detail = (await owner.json<any>(`/api/admin/website/documents/${about.id}`)).body
    const original = detail.draft.hero.title
    const changed = `About test ${run}`

    const saved = await pm.json<any>(`/api/admin/website/documents/${about.id}/draft`, { method: 'PUT', json: { content: { ...detail.draft, hero: { ...detail.draft.hero, title: changed } }, version: detail.draftVersion } })
    assert.equal(saved.status, 200, JSON.stringify(saved.body).slice(0, 300))
    assert.equal(saved.body.document.dirty, true)
    assert.equal(saved.body.document.chip.label, 'Published · draft changes')
    assert.ok(await siteShows('/about', changed, false), 'the live page does not show the draft')

    const stale = await owner.json<any>(`/api/admin/website/documents/${about.id}/draft`, { method: 'PUT', json: { content: detail.draft, version: detail.draftVersion } })
    assert.equal(stale.status, 409, 'a save over a newer save is refused')

    const bad = await pm.json<any>(`/api/admin/website/documents/${about.id}/draft`, { method: 'PUT', json: { content: { ...detail.draft, hero: { ...detail.draft.hero, title: '' } }, version: saved.body.draftVersion } })
    assert.equal(bad.status, 400)
    assert.ok(bad.body.data.fieldErrors['hero.title'], 'the error names the field')

    assert.equal((await pm.json<any>(`/api/admin/website/documents/${about.id}/publish`, { method: 'POST', json: { version: saved.body.draftVersion } })).status, 403, 'a project manager cannot publish')
    const published = await owner.json<any>(`/api/admin/website/documents/${about.id}/publish`, { method: 'POST', json: { version: saved.body.draftVersion, note: 'Phase B test' } })
    assert.equal(published.status, 200, JSON.stringify(published.body).slice(0, 300))
    assert.equal(published.body.revision, detail.liveRevision + 1, 'a publish adds the next revision')
    assert.equal(published.body.revalidated, true, 'the panel told the site to drop its cache')
    assert.ok(await siteShows('/about', changed), 'the site shows the published words')

    const restored = await owner.json<any>(`/api/admin/website/documents/${about.id}/restore`, { method: 'POST', json: { revision: 1 } })
    assert.equal(restored.status, 200)
    const back = await owner.json<any>(`/api/admin/website/documents/${about.id}/publish`, { method: 'POST', json: { version: restored.body.draftVersion, note: 'Back to the original' } })
    assert.equal(back.status, 200)
    assert.ok(await siteShows('/about', original), 'restoring revision 1 and publishing puts the original back')
    assert.equal((await owner.json<any>(`/api/admin/website/documents/${about.id}/publish`, { method: 'POST', json: { version: restored.body.draftVersion } })).status, 409, 'nothing left to publish')
  })

  it('a built article goes through review: submit, changes requested, approve', async () => {
    const created = await pm.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-article', title: `Review test ${run}`, path: `/insights/review-test-${run}` } })
    assert.equal(created.status, 200, JSON.stringify(created.body).slice(0, 300))
    const id = created.body.document.id
    assert.equal(created.body.editor, `/admin/website/insights/${id}`)

    const detail = (await pm.json<any>(`/api/admin/website/documents/${id}`)).body
    assert.equal(detail.draft.sections[0].type, 'hero')
    const early = await pm.json<any>(`/api/admin/website/documents/${id}/submit`, { method: 'POST', json: {} })
    assert.equal(early.status, 400, 'an article without its summary cannot be submitted')

    const content = { ...detail.draft, meta: { ...detail.draft.meta, summary: 'A test article for the review flow.' } }
    content.sections[1].fields.body = 'The short version of a test article.'
    const saved = await pm.json<any>(`/api/admin/website/documents/${id}/draft`, { method: 'PUT', json: { content, version: detail.draftVersion } })
    assert.equal(saved.status, 200, JSON.stringify(saved.body).slice(0, 300))

    const submitted = await pm.json<any>(`/api/admin/website/documents/${id}/submit`, { method: 'POST', json: { note: 'First draft' } })
    assert.equal(submitted.status, 200)
    assert.equal(submitted.body.document.chip.label, 'In review')
    const locked = await pm.json<any>(`/api/admin/website/documents/${id}/draft`, { method: 'PUT', json: { content, version: saved.body.draftVersion } })
    assert.equal(locked.status, 409, 'the author cannot edit while it waits')

    assert.equal((await pm.json<any>(`/api/admin/website/documents/${id}/request-changes`, { method: 'POST', json: { note: 'Not mine to decide' } })).status, 403)
    assert.equal((await owner.json<any>(`/api/admin/website/documents/${id}/request-changes`, { method: 'POST', json: {} })).status, 400, 'a reason is required')
    const back = await owner.json<any>(`/api/admin/website/documents/${id}/request-changes`, { method: 'POST', json: { note: 'Add a closing line' } })
    assert.equal(back.status, 200)
    const withNote = (await pm.json<any>(`/api/admin/website/documents/${id}`)).body
    assert.equal(withNote.changesRequested?.note, 'Add a closing line')

    await pm.json(`/api/admin/website/documents/${id}/submit`, { method: 'POST', json: {} })
    const page = (await owner.json<any>(`/api/admin/website/documents/${id}`)).body
    const approved = await owner.json<any>(`/api/admin/website/documents/${id}/publish`, { method: 'POST', json: { version: page.draftVersion } })
    assert.equal(approved.status, 200, JSON.stringify(approved.body).slice(0, 300))
    assert.equal(approved.body.document.chip.label, 'Published')

    const history = await finance.json<any>('/api/admin/website/history?pageSize=10')
    assert.equal(history.status, 200)
    assert.ok(history.body.items.some((h: any) => h.action === 'Changes requested' && h.reason === 'Add a closing line'))

    if (SITE) {
      const live = await siteHtml(`/insights/review-test-${run}`)
      assert.equal(live.status, 200)
      assert.ok(live.html.includes(`Review test ${run}`))
      assert.ok(live.html.includes('The short version of a test article.'))
    }
  })

  it('a built page is live at its own address and in the manifest; addresses are checked', async () => {
    const reserved = await support.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-page', title: 'Clash', path: '/services/new' } })
    assert.equal(reserved.status, 400, 'a page cannot take a route the site has')
    const created = await support.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-page', title: `Landing ${run}`, path: `/landing-${run}` } })
    assert.equal(created.status, 200)
    const twice = await support.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-page', title: 'Again', path: `/landing-${run}` } })
    assert.equal(twice.status, 409, 'an address is used once')
    assert.equal((await finance.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-page', title: 'No', path: `/no-${run}` } })).status, 403, 'finance can read but not draft')

    const id = created.body.document.id
    const detail = (await owner.json<any>(`/api/admin/website/documents/${id}`)).body
    const preview = await owner.json<any>(`/api/admin/website/documents/${id}/preview`, { method: 'POST', json: {} })
    assert.equal(preview.status, 200)
    const published = await owner.json<any>(`/api/admin/website/documents/${id}/publish`, { method: 'POST', json: { version: detail.draftVersion } })
    assert.equal(published.status, 200, JSON.stringify(published.body).slice(0, 300))
    const manifest = await owner.json<any>('/api/site/manifest')
    assert.ok(manifest.body.pages.some((p: any) => p.key === `/landing-${run}` && p.built), 'the manifest lists it')

    if (SITE) {
      assert.ok(await siteShows(`/landing-${run}`, `Landing ${run}`), 'the site renders the built page')
      const draft = await siteHtml(`/preview/${preview.body.token}`)
      assert.equal(draft.status, 200)
      assert.ok(draft.html.includes('Preview of a draft'))
      assert.equal((await siteHtml('/preview/not.a.token')).status, 404)
      assert.equal((await siteHtml(`/nothing-here-${run}`)).status, 404, 'an unknown address is still a 404')
    }
  })
})
