import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { TEMPLATES, validateContent } from '../../shared/cms/index.ts'

/**
 * Against a live site dev server (`SITE_TEST_URL`, e.g. http://localhost:3001):
 * every code baseline document the site serves passes its own template, and
 * every page the site renders from code has one. Skips without the URL.
 */
const BASE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')

describe('site baseline documents', { skip: !BASE && 'SITE_TEST_URL is not set' }, () => {
  it('serves one valid document per fixed template, service, case study and written article', async () => {
    const res = await fetch(`${BASE}/api/cms/baseline`)
    assert.equal(res.status, 200)
    const body = await res.json() as { version: number, documents: { template: keyof typeof TEMPLATES, key: string, content: unknown }[] }
    assert.equal(body.version, 1)
    const keys = new Set<string>()
    for (const doc of body.documents) {
      assert.ok(TEMPLATES[doc.template], `${doc.template} is a template`)
      const check = validateContent(doc.template, doc.content)
      assert.ok(check.ok, `${doc.template} ${doc.key}: ${check.ok ? '' : JSON.stringify(check.issues)}`)
      const id = `${doc.template}:${doc.key}`
      assert.ok(!keys.has(id), `${id} appears once`)
      keys.add(id)
    }
    for (const expected of ['home:/', 'services:/services', 'our-work:/our-work', 'insights:/insights', 'about:/about', 'contact:/contact', 'header:header', 'footer:footer', 'service:/services/website-design', 'case-study:/our-work/hartley-and-sons', 'article:/insights/website-cost-uk-2026']) {
      assert.ok(keys.has(expected), expected)
    }
  })
})
