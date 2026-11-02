/* eslint-disable test/no-import-node-test -- Node's own runner, no framework */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { serializeError } from '../../shared/log.ts'
import { maskEmail, maskIp, maskPhone, redact, redactString } from '../../shared/redact.ts'

describe('redact', () => {
  it('replaces secrets wholesale, whatever the key spelling', () => {
    const out = redact({ password: 'hunter2', newPassword: 'x', api_key: 'k', Authorization: 'Bearer abc', backupCodes: ['1', '2'], ticket: 't', cvc: '123' }) as Record<string, unknown>
    for (const v of Object.values(out)) {
      assert.equal(v, '[redacted]')
    }
  })

  it('leaves empty secrets empty, so "not set" stays visible', () => {
    assert.deepEqual(redact({ password: '', token: null }), { password: '', token: null })
  })

  it('masks personal data by key', () => {
    const out = redact({ email: 'jane.doe@example.com', phone: '+44 7700 900123', address: '1 High St', postcode: 'SW1A 1AA', content: 'hello there' }) as Record<string, string>
    assert.equal(out.email, 'j***@example.com')
    assert.equal(out.phone, '***23')
    assert.equal(out.address, '[redacted:9 chars]')
    assert.equal(out.postcode, '[redacted:8 chars]')
    assert.equal(out.content, '[redacted:11 chars]')
  })

  it('redacts a one-time code but keeps an error code', () => {
    assert.deepEqual(redact({ code: '123456' }), { code: '[redacted]' })
    assert.deepEqual(redact({ code: 'P2002' }), { code: 'P2002' })
  })

  it('masks secrets and addresses inside free text', () => {
    const text = redactString('user bob@corp.co.uk paid with 4242 4242 4242 4242 using eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyJ9.c2lnbmF0dXJlLXZhbHVl and Bearer abc.def')
    assert.ok(!text.includes('bob@corp'))
    assert.ok(text.includes('b***@corp.co.uk'))
    assert.ok(text.includes('[redacted-pan:4242]'))
    assert.ok(text.includes('[redacted-jwt]'))
    assert.ok(text.includes('Bearer [redacted]'))
  })

  it('keeps long numbers that are not card numbers', () => {
    assert.equal(redactString('order 1234567890123'), 'order 1234567890123')
  })

  it('walks nested objects and arrays without mutating them', () => {
    const input = { user: { email: 'a@b.co', items: [{ password: 'p' }] } }
    const out = redact(input) as any
    assert.equal(out.user.email, 'a***@b.co')
    assert.equal(out.user.items[0].password, '[redacted]')
    assert.equal(input.user.items[0]!.password, 'p')
  })

  it('masks shapes on their own', () => {
    assert.equal(maskEmail('x@y.z'), 'x***@y.z')
    assert.equal(maskPhone('12'), '[redacted]')
    assert.equal(maskIp('203.0.113.77'), '203.0.113.0')
    assert.equal(maskIp('::ffff:198.51.100.9'), '198.51.100.0')
    assert.equal(maskIp('2001:db8:85a3:8d3:1319:8a2e:370:7348'), '2001:db8:85a3::/48')
    assert.equal(maskIp('::1'), 'loopback')
    assert.equal(maskIp(undefined), undefined)
  })
})

describe('serializeError', () => {
  it('keeps the status, the code and the failing fields, not the values', () => {
    const e = Object.assign(new Error('Validation failed'), { statusCode: 400, data: { fieldErrors: { email: ['bad'], password: ['short'] } } })
    const out = serializeError(e, false)
    assert.equal(out.statusCode, 400)
    assert.deepEqual(out.fields, ['email', 'password'])
    assert.equal(out.stack, undefined)
  })

  it('cuts a database error to its last line, which names the problem but not the query', () => {
    const e = Object.assign(new Error('Invalid `prisma.user.create()` invocation:\n{ data: { email: "a@b.co", password: "x" } }\nUnique constraint failed on the fields: (`email`)'), { name: 'PrismaClientKnownRequestError', code: 'P2002' })
    const out = serializeError(e)
    assert.equal(out.message, 'Unique constraint failed on the fields: (`email`)')
    assert.equal(out.code, 'P2002')
  })

  it('handles a thrown non-error', () => {
    assert.deepEqual(serializeError('boom'), { name: 'NonError', message: 'boom' })
  })
})
