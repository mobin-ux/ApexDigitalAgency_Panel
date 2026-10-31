import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import {
  baselineContent,
  f,
  fill,
  isSafeInternalPath,
  linkSchema,
  mapToZod,
  normalisePath,
  resolveSeo,
  TEMPLATE_KEYS,
  TEMPLATES,
  toZod,
  validateContent,
} from '../../shared/cms/index.ts'

describe('field DSL', () => {
  it('text fields enforce length, required and placeholders', () => {
    const plain = toZod(f.text({ label: 'x', max: 5 }))
    assert.equal(plain.safeParse('').success, true)
    assert.equal(plain.safeParse('toolong').success, false)
    assert.equal(plain.safeParse('{year}').success, false, 'braces refused without a declared placeholder')

    const required = toZod(f.text({ label: 'x', max: 20, required: true, placeholders: ['year'] }))
    assert.equal(required.safeParse('').success, false)
    assert.equal(required.safeParse('Since {year}').success, true)
    assert.equal(required.safeParse('Since {yesterday}').success, false)
  })

  it('formats refuse unsafe values and accept empty', () => {
    const path = toZod(f.text({ label: 'x', max: 100, format: 'path' }))
    assert.equal(path.safeParse('/about').success, true)
    assert.equal(path.safeParse('javascript:alert(1)').success, false)
    assert.equal(path.safeParse('').success, true)
    const when = toZod(f.text({ label: 'x', max: 25, format: 'datetime' }))
    assert.equal(when.safeParse('2026-11-01T09:00').success, true)
    assert.equal(when.safeParse('tomorrow').success, false)
  })

  it('objects strip unknown keys and lists honour bounds', () => {
    const schema = mapToZod({
      items: f.list({ label: 'x', min: 1, max: 2, item: f.object({ label: 'i', fields: { a: f.text({ label: 'a', max: 3 }) } }) }),
    })
    const ok = schema.safeParse({ items: [{ a: 'x', extra: true }], junk: 1 })
    assert.equal(ok.success, true)
    assert.deepEqual(ok.success && ok.data, { items: [{ a: 'x' }] })
    assert.equal(schema.safeParse({ items: [] }).success, false)
    assert.equal(schema.safeParse({ items: [{ a: '1' }, { a: '2' }, { a: '3' }] }).success, false)
  })

  it('fill substitutes declared tokens and leaves the rest', () => {
    assert.equal(fill('Since {year}, {other}', { year: 2024 }), 'Since 2024, {other}')
  })
})

describe('links', () => {
  it('accepts site paths and https only', () => {
    assert.equal(linkSchema.safeParse({ kind: 'internal', path: '/services?goal=leads#top' }).success, true)
    assert.equal(linkSchema.safeParse({ kind: 'external', url: 'https://example.com/x' }).success, true)
    assert.equal(linkSchema.safeParse({ kind: 'external', url: 'http://example.com' }).success, false)
    assert.equal(linkSchema.safeParse({ kind: 'internal', path: '//evil.com' }).success, false)
    assert.equal(linkSchema.safeParse({ kind: 'internal', path: '/a/../b' }).success, false)
    assert.equal(linkSchema.safeParse({ kind: 'panel', key: 'dashboard' }).success, false, 'panel links are gone')
  })

  it('isSafeInternalPath and normalisePath agree on shape', () => {
    assert.equal(isSafeInternalPath('/'), true)
    assert.equal(isSafeInternalPath('about'), false)
    assert.equal(isSafeInternalPath('/a b'), false)
    assert.equal(normalisePath('/About/'), '/about')
    assert.equal(normalisePath('/'), '/')
    assert.equal(normalisePath('//x//y/?Q=1'), '/x/y?Q=1')
  })
})

describe('templates', () => {
  it('every template field map builds a schema', () => {
    for (const key of TEMPLATE_KEYS) {
      assert.doesNotThrow(() => mapToZod(TEMPLATES[key].fields), key)
    }
  })

  it('validateContent reports dotted paths', () => {
    const result = validateContent('header', { nav: [], start: '', servicesLabel: 'x', allServices: 'x', menuDescription: '', sections: {} })
    assert.equal(result.ok, false)
    assert.ok(!result.ok && result.issues.some(i => i.path === 'nav'))
    assert.ok(!result.ok && result.issues.some(i => i.path === 'start'))
  })

  it('baselineContent refuses a baseline that fails its own template', () => {
    assert.throws(() => baselineContent('announcement', { enabled: true, text: 'x', link: undefined, tone: 'loud' as never, startsAt: '', endsAt: '' }), /baseline/)
  })
})

describe('resolveSeo', () => {
  it('page beats template beats site, and robots never inherits from the site', () => {
    const r = resolveSeo({ title: '', description: 'page d', robots: 'noindex,follow' }, { title: 'tpl t' }, { title: 'site t', description: 'site d' })
    assert.equal(r.title, 'tpl t')
    assert.equal(r.description, 'page d')
    assert.equal(r.ogTitle, 'tpl t')
    assert.equal(r.noindex, true)
    assert.equal(resolveSeo(null, null, { robots: 'noindex,nofollow' } as never).robots, 'index,follow')
  })
})
