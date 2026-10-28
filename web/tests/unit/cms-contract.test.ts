import type { TemplateContent, WorkflowDoc } from '../../shared/cms/index.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import {
  availableActions,
  displayStatus,
  f,
  fieldPaths,
  fill,
  isSafeInternalPath,
  linkSchema,
  mapToZod,
  normalisePath,
  resolveDocument,
  resolveSeo,
  sectionSchema,
  TEMPLATE_KEYS,
  TEMPLATES,
  toZod,
  transition,
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

  it('fieldPaths flattens nested objects and fill substitutes declared tokens', () => {
    const paths = fieldPaths({ a: f.object({ label: 'a', fields: { b: f.text({ label: 'b', max: 1 }), c: f.boolean({ label: 'c' }) } }), d: f.number({ label: 'd' }) })
    assert.deepEqual(paths.map(p => p.path), ['a.b', 'a.c', 'd'])
    assert.equal(fill('Since {year}, {other}', { year: 2024 }), 'Since 2024, {other}')
  })
})

describe('links', () => {
  it('accepts site paths, panel keys and https only', () => {
    assert.equal(linkSchema.safeParse({ kind: 'internal', path: '/services?goal=leads#top' }).success, true)
    assert.equal(linkSchema.safeParse({ kind: 'panel', key: 'signup' }).success, true)
    assert.equal(linkSchema.safeParse({ kind: 'external', url: 'https://example.com/x' }).success, true)
    assert.equal(linkSchema.safeParse({ kind: 'external', url: 'http://example.com' }).success, false)
    assert.equal(linkSchema.safeParse({ kind: 'internal', path: '//evil.com' }).success, false)
    assert.equal(linkSchema.safeParse({ kind: 'internal', path: '/a/../b' }).success, false)
    assert.equal(linkSchema.safeParse({ kind: 'panel', key: 'admin' }).success, false)
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

describe('sections and templates', () => {
  it('every template field map builds a schema', () => {
    for (const key of TEMPLATE_KEYS) {
      assert.doesNotThrow(() => mapToZod(TEMPLATES[key].fields), key)
    }
  })

  it('a section of an unknown type is refused by the schema', () => {
    assert.equal(sectionSchema.safeParse({ id: 'a1', type: 'carousel', hidden: false, props: {} }).success, false)
    assert.equal(sectionSchema.safeParse({ id: 'a1', type: 'cta', hidden: false, props: { title: 'Go', text: '', button: { label: 'Now', link: { kind: 'panel', key: 'signup' } } } }).success, true)
  })

  it('validateContent reports dotted paths', () => {
    const result = validateContent('landing', { title: '', sections: [], seo: {} })
    assert.equal(result.ok, false)
    assert.ok(!result.ok && result.issues.some(i => i.path === 'title'))
    assert.ok(!result.ok && result.issues.some(i => i.path === 'seo.robots'))
  })
})

describe('resolveDocument', () => {
  const baseline: TemplateContent<'landing'> = {
    title: 'Baseline',
    sections: [{ id: 's1', type: 'cta', hidden: false, props: { title: 'Base CTA', text: '', button: { label: 'Go', link: { kind: 'panel', key: 'signup' } } } }],
    seo: { title: '', description: '', canonical: '', robots: 'index,follow', ogTitle: '', ogDescription: '', ogImage: undefined },
  }

  it('renders the baseline when there is no overlay', () => {
    const { content, managed, warnings } = resolveDocument('landing', baseline, null)
    assert.equal(managed, false)
    assert.equal(warnings.length, 0)
    assert.equal(content.title, 'Baseline')
  })

  it('takes valid overlay fields and keeps the baseline for invalid ones', () => {
    const { content, managed, warnings } = resolveDocument('landing', baseline, { title: 'Managed', seo: { description: 'x'.repeat(200) } })
    assert.equal(managed, true)
    assert.equal(content.title, 'Managed')
    assert.equal(content.seo.description, '', 'the over-long description fell back')
    assert.ok(warnings.some(w => w.path === 'seo.description'))
  })

  it('drops unknown or invalid sections one by one', () => {
    const { content, warnings } = resolveDocument('landing', baseline, {
      sections: [
        { id: 'ok', type: 'banner', hidden: false, props: { text: 'Hi', tone: 'info' } },
        { id: 'bad', type: 'carousel', hidden: false, props: {} },
        { id: 'bad2', type: 'cta', hidden: false, props: { title: '' } },
      ],
    })
    assert.deepEqual(content.sections.map(s => s.id), ['ok'])
    assert.equal(warnings.length, 2)
  })

  it('refuses a baseline that fails its own template', () => {
    assert.throws(() => resolveDocument('landing', { ...baseline, title: '' }, null), /baseline/)
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

describe('workflow', () => {
  const fresh: WorkflowDoc = { status: 'DRAFT', review: 'NONE', publishedRevisionId: null, scheduledRevisionId: null, scheduledFor: null, draftChanged: true }
  const live: WorkflowDoc = { ...fresh, status: 'PUBLISHED', publishedRevisionId: 'r1', draftChanged: false }

  it('folds the two axes into one display status', () => {
    assert.equal(displayStatus(fresh), 'draft')
    assert.equal(displayStatus({ ...fresh, review: 'IN_REVIEW' }), 'in_review')
    assert.equal(displayStatus(live), 'published')
    assert.equal(displayStatus({ ...live, draftChanged: true }), 'published_changes')
    assert.equal(displayStatus({ ...live, scheduledRevisionId: 'r2' }), 'scheduled')
    assert.equal(displayStatus({ ...live, status: 'ARCHIVED' }), 'archived')
  })

  it('walks draft → review → approved → published', () => {
    const submitted = transition(fresh, 'submit')
    assert.ok(submitted.ok && submitted.patch.review === 'IN_REVIEW')
    assert.equal(transition({ ...fresh, review: 'IN_REVIEW' }, 'submit').ok, false)
    const approved = transition({ ...fresh, review: 'IN_REVIEW' }, 'approve')
    assert.ok(approved.ok && approved.patch.review === 'APPROVED')
    assert.equal(transition(fresh, 'approve').ok, false)
    const published = transition({ ...fresh, review: 'APPROVED' }, 'publish')
    assert.ok(published.ok && published.effect === 'publish-draft' && published.patch.status === 'PUBLISHED')
  })

  it('refuses the no-op publish and the past schedule with the sentence the screen shows', () => {
    const again = transition(live, 'publish')
    assert.ok(!again.ok && /already published/.test(again.reason))
    const past = transition(fresh, 'schedule', { scheduledFor: new Date(Date.now() - 1000) })
    assert.ok(!past.ok && /at least a minute/.test(past.reason))
    const future = transition(fresh, 'schedule', { scheduledFor: new Date(Date.now() + 3_600_000) })
    assert.ok(future.ok && future.effect === 'schedule-draft')
  })

  it('only a never-published draft can be deleted; archived documents must be restored first', () => {
    assert.equal(transition(fresh, 'delete').ok, true)
    assert.equal(transition(live, 'delete').ok, false)
    assert.equal(transition({ ...fresh, scheduledRevisionId: 'r2' }, 'delete').ok, false)
    const archived: WorkflowDoc = { ...live, status: 'ARCHIVED' }
    assert.equal(transition(archived, 'publish').ok, false)
    assert.equal(transition(archived, 'restore').ok, true)
  })

  it('availableActions lists exactly what would succeed', () => {
    assert.deepEqual(availableActions(fresh), ['submit', 'publish', 'schedule', 'archive', 'delete'])
    assert.deepEqual(availableActions(live), ['unpublish', 'archive'])
    assert.deepEqual(availableActions({ ...live, draftChanged: true, review: 'IN_REVIEW' }), ['approve', 'reject', 'publish', 'schedule', 'unpublish', 'archive'])
  })
})
