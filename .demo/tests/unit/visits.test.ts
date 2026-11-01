import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { signEnquiry } from '../../shared/enquiry.ts'
import { addDays, AUTOMATED_AGENT, signVisits, verifyVisitsSignature, visitDay, visitPath, visitSource } from '../../shared/visits.ts'

describe('visit counting rules (site → console)', () => {
  it('keeps a page path and nothing else', () => {
    assert.equal(visitPath('/'), '/')
    assert.equal(visitPath('/services/seo/'), '/services/seo')
    assert.equal(visitPath('/insights?q=my+name#top'), '/insights')
    assert.equal(visitPath('//evil.example/x'), null)
    assert.equal(visitPath('https://evil.example/'), null)
    assert.equal(visitPath('/api/contact'), null)
    assert.equal(visitPath('/_nuxt/entry.js'), null)
    assert.equal(visitPath('/preview/abc'), null)
    assert.equal(visitPath('/<script>'), null)
    assert.equal(visitPath(`/${'a'.repeat(250)}`), null)
    assert.equal(visitPath(42), null)
  })

  it('names the source by host or tag, and knows a page of its own site', () => {
    assert.equal(visitSource('', '', 'apexdigi.co.uk'), 'Direct')
    assert.equal(visitSource('www.google.co.uk', '', 'apexdigi.co.uk'), 'Google search')
    assert.equal(visitSource('com.google.android.googlequicksearchbox', '', 'apexdigi.co.uk'), 'Google search')
    assert.equal(visitSource('l.facebook.com', '', 'apexdigi.co.uk'), 'Facebook')
    assert.equal(visitSource('t.co', '', 'apexdigi.co.uk'), 'X')
    assert.equal(visitSource('www.example.org', '', 'apexdigi.co.uk'), 'example.org')
    assert.equal(visitSource('not a host', '', 'apexdigi.co.uk'), 'Other')
    assert.equal(visitSource('www.google.com', 'gbp', 'apexdigi.co.uk'), 'Google Business Profile', 'a tag wins')
    assert.equal(visitSource('', 'spring_mailer', 'apexdigi.co.uk'), 'spring_mailer')
    assert.equal(visitSource('', 'jane@example.com', 'apexdigi.co.uk'), 'Direct', 'an address is not a tag')
    assert.equal(visitSource('www.apexdigi.co.uk', '', 'apexdigi.co.uk'), null)
    assert.equal(visitSource('localhost', '', 'localhost:3001'), null, 'the dev site is its own site too')
    assert.equal(visitSource('intranet', '', 'apexdigi.co.uk'), 'Other', 'a bare name is not a host')
  })

  it('counts by London day', () => {
    assert.equal(visitDay(new Date('2026-07-01T23:30:00Z')), '2026-07-02', 'BST: already tomorrow in London')
    assert.equal(visitDay(new Date('2026-12-01T23:30:00Z')), '2026-12-01', 'GMT')
    assert.equal(addDays('2026-03-01', -1), '2026-02-28')
    assert.equal(addDays('2026-10-25', 6), '2026-10-31')
  })

  it('signs with its own key, so an enquiry signature does not pass', () => {
    const now = Date.UTC(2026, 10, 2, 12)
    const ts = String(now / 1000)
    const body = '{"id":"x","buckets":[]}'
    assert.equal(verifyVisitsSignature('s', ts, signVisits('s', ts, body), body, now), true)
    assert.equal(verifyVisitsSignature('s', ts, signEnquiry('s', ts, body), body, now), false)
    assert.equal(verifyVisitsSignature('', ts, signVisits('', ts, body), body, now), false)
  })

  it('leaves out self-declared bots', () => {
    assert.ok(AUTOMATED_AGENT.test('Mozilla/5.0 (compatible; Googlebot/2.1)'))
    assert.ok(AUTOMATED_AGENT.test('Mozilla/5.0 HeadlessChrome/120'))
    assert.ok(!AUTOMATED_AGENT.test('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'))
  })
})
