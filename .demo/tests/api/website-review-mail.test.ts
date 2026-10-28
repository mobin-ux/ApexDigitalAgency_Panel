import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { client, DEV_ACCOUNTS, enabled, login, staffClient, staffEmailFor } from './helpers.ts'

/**
 * The website review steps as notifications (ADR-022, Gate 4), on a
 * keyless dev server: a submitted draft reaches the publishers, approve
 * and reject go back to the editor, a publish by someone else tells the
 * editor, and nobody hears about their own action.
 */
async function reviewMail(to: string, title: string): Promise<{ subject: string, status: string, text: string }[]> {
  const res = await client().json<any>(`/api/_test/mail?to=${encodeURIComponent(to)}`)
  assert.equal(res.status, 200)
  return res.body.items.filter((r: any) => r.kind === 'cms-review' && r.subject.includes(title))
}

describe('website review emails', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 120_000 }, () => {
  let owner: Client
  let editor: Client
  let publisher: Client
  const stamp = Date.now().toString(36)
  const title = `Review mail ${stamp}`
  const editorEmail = staffEmailFor('editor')
  const publisherEmail = staffEmailFor('publisher')
  let id = ''

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    editor = await staffClient(owner, 'editor')
    publisher = await staffClient(owner, 'publisher')
    for (const c of [editor, publisher]) {
      await c.json('/api/settings/preferences', { method: 'PATCH', json: { emailNotifications: true } })
    }
  })

  it('a submitted draft reaches everyone who can publish, not the editor who submitted it', async () => {
    const created = await editor.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'landing', key: `/offers/review-${stamp}`, title } })
    assert.equal(created.status, 200, JSON.stringify(created.body))
    id = created.body.id
    const detail = await editor.json<any>(`/api/admin/website/documents/${id}`)
    const saved = await editor.json<any>(`/api/admin/website/documents/${id}`, { method: 'PUT', json: { version: detail.body.draftVersion, content: { ...detail.body.draft, sections: [{ id: 'b', type: 'banner', hidden: false, props: { text: 'Review me', tone: 'info' } }] } } })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))

    const submitted = await editor.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'submit' } })
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body))

    const toPublisher = await reviewMail(publisherEmail, title)
    assert.equal(toPublisher.length, 1, 'the publisher is told')
    assert.match(toPublisher[0]!.subject, /is waiting for review/)
    assert.match(toPublisher[0]!.text, new RegExp(`/admin/website/pages/${id}`))
    const toOwner = await reviewMail(DEV_ACCOUNTS.owner.identifier, title)
    assert.equal(toOwner.length, 1, 'the owner holds website.publish too')
    assert.equal((await reviewMail(editorEmail, title)).length, 0, 'the editor is not told about their own submission')
  })

  it('send back and approve go to the editor who submitted; the publisher is not told about their own decision', async () => {
    const rejected = await publisher.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'reject' } })
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body))
    const back = await reviewMail(editorEmail, title)
    assert.equal(back.length, 1)
    assert.match(back[0]!.subject, /was sent back/)
    assert.equal((await reviewMail(publisherEmail, title)).length, 1, 'still only the submission mail for the publisher')

    const again = await editor.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'submit' } })
    assert.equal(again.status, 200)
    const approved = await publisher.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'approve' } })
    assert.equal(approved.status, 200, JSON.stringify(approved.body))
    const ok = await reviewMail(editorEmail, title)
    assert.equal(ok.length, 2)
    assert.ok(ok.some(r => /was approved/.test(r.subject)))
  })

  it('a publish by someone else tells the last editor the words are live', async () => {
    const published = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'publish' } })
    assert.equal(published.status, 200, JSON.stringify(published.body))
    const live = await reviewMail(editorEmail, title)
    assert.ok(live.some(r => /is live/.test(r.subject)), 'the editor is told it went live')
    const ownerRows = await reviewMail(DEV_ACCOUNTS.owner.identifier, title)
    assert.equal(ownerRows.length, 2, 'the owner was told of the two submissions, nothing else')
    assert.ok(!ownerRows.some(r => /is live/.test(r.subject)), 'the owner is not told about their own publish')

    const archived = await owner.json<any>(`/api/admin/website/documents/${id}/transition`, { method: 'POST', json: { action: 'archive' } })
    assert.equal(archived.status, 200)
  })
})
