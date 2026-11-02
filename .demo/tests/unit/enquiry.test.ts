import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { enquiryRetentionCutoff } from '../../shared/enquiry-status.ts'
import { enquirySource, signEnquiry, verifyEnquirySignature } from '../../shared/enquiry.ts'

describe('enquiry signature (site → console)', () => {
  const secret = 'test-secret'
  const now = Date.UTC(2026, 10, 2, 12, 0, 0)
  const ts = String(now / 1000)
  const body = '{"name":"Jane"}'

  it('accepts what the site signed, within five minutes', () => {
    assert.equal(verifyEnquirySignature(secret, ts, signEnquiry(secret, ts, body), body, now), true)
    assert.equal(verifyEnquirySignature(secret, ts, signEnquiry(secret, ts, body), body, now + 299_000), true)
  })

  it('refuses a stale, altered, unsigned or unconfigured call', () => {
    assert.equal(verifyEnquirySignature(secret, ts, signEnquiry(secret, ts, body), body, now + 301_000), false)
    assert.equal(verifyEnquirySignature(secret, ts, signEnquiry(secret, ts, body), '{"name":"Jan"}', now), false)
    assert.equal(verifyEnquirySignature(secret, ts, signEnquiry('other', ts, body), body, now), false)
    assert.equal(verifyEnquirySignature(secret, undefined, undefined, body, now), false)
    assert.equal(verifyEnquirySignature('', ts, signEnquiry('', ts, body), body, now), false)
    assert.equal(verifyEnquirySignature(secret, '12abc', 'zz', body, now), false)
  })

  it('keeps only a path on this site as the source', () => {
    assert.equal(enquirySource('/contact?service=seo'), '/contact?service=seo')
    assert.equal(enquirySource('//evil.example/x'), '')
    assert.equal(enquirySource('https://evil.example/'), '')
    assert.equal(enquirySource(42), '')
  })
})

describe('enquiry retention', () => {
  it('is 24 months', () => {
    assert.equal(enquiryRetentionCutoff(new Date('2026-11-02T03:17:00Z')).toISOString(), '2024-11-02T03:17:00.000Z')
  })
})
