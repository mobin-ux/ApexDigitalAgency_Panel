import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { checkBuiltPath, collectionOf, DOCUMENT_TEMPLATES, EMPTY_SEO, emptySection, faqItems, lines, paragraphs, resolveDocument, SECTION_TYPE_KEYS, sectionMediaIds, slugify, statusChip, TEMPLATES, validateDocumentContent } from '../../shared/cms/index.ts'

/**
 * The document contract the admin console's Website screens and the site
 * share (ADR-026): built documents, addresses, the overlay of a published
 * coded document on its baseline, and the status the lists show.
 */

function builtPage(sections = [emptySection('hero', 's1')]) {
  sections[0]!.fields = { ...sections[0]!.fields, title: 'A page' } as never
  return { sections, seo: EMPTY_SEO, meta: {} }
}

describe('built documents', () => {
  it('the design\'s section types are all declared, without the service-only price block', () => {
    assert.deepEqual([...SECTION_TYPE_KEYS].sort(), ['cards', 'cta', 'faq', 'hero', 'image', 'quote', 'services', 'steps', 'text'])
  })

  it('accepts a complete document and refuses unsafe links, unknown types and duplicate ids', () => {
    assert.equal(validateDocumentContent('built-page', builtPage()).ok, true)

    const bad = builtPage()
    bad.sections[0]!.fields = { ...bad.sections[0]!.fields, primaryLink: 'javascript:alert(1)' } as never
    const refused = validateDocumentContent('built-page', bad)
    assert.equal(refused.ok, false)
    assert.ok(!refused.ok && refused.issues.some(i => i.path === 'sections.0.fields.primaryLink'))

    const unknown = { ...builtPage(), sections: [{ id: 's1', type: 'script', hidden: false, fields: {} }] }
    assert.equal(validateDocumentContent('built-page', unknown).ok, false)

    const twice = builtPage([emptySection('hero', 'same'), emptySection('cta', 'same')])
    assert.equal(validateDocumentContent('built-page', twice).ok, false)
    assert.equal(validateDocumentContent('built-page', { ...builtPage(), sections: [] }).ok, false, 'at least one section')
  })

  it('an article needs its summary; a case study its sector and service', () => {
    const article = { ...builtPage(), meta: { category: 'seo', readMinutes: 5, summary: '' } }
    assert.equal(validateDocumentContent('built-article', article).ok, false)
    assert.equal(validateDocumentContent('built-article', { ...article, meta: { ...article.meta, summary: 'One line.' } }).ok, true)
    assert.equal(validateDocumentContent('built-case-study', { ...builtPage(), meta: { sector: '', service: 'SEO', summary: 'x' } }).ok, false)
  })

  it('splits the "one per line" fields the way the editor writes them', () => {
    assert.deepEqual(lines(' First \n\nSecond\n'), ['First', 'Second'])
    assert.deepEqual(faqItems('Is it credit? No. A schedule.\nNo question mark'), [
      { question: 'Is it credit?', answer: 'No. A schedule.' },
      { question: 'No question mark', answer: '' },
    ])
    assert.deepEqual(paragraphs('One\nstill one\n\nTwo'), ['One\nstill one', 'Two'])
    assert.deepEqual(sectionMediaIds([{ id: 'a', type: 'image', hidden: false, fields: { media: 'm1', caption: '' } }, { id: 'b', type: 'image', hidden: true, fields: { media: 'm1', caption: '' } }]), ['m1'])
  })
})

describe('addresses', () => {
  it('a built page keeps clear of the site\'s routes and files', () => {
    assert.deepEqual(checkBuiltPath('built-page', '/Pay-Monthly/'), { ok: true, path: '/pay-monthly' })
    for (const taken of ['/', '/services/x', '/our-work', '/api/x', '/_nuxt/a', '/preview/t', '/a/b/c/d', '/has space']) {
      assert.equal(checkBuiltPath('built-page', taken).ok, false, taken)
    }
    // The footer's legal pages and careers have no code; they are published from the console (AUD-01).
    assert.deepEqual(checkBuiltPath('built-page', '/legal/privacy'), { ok: true, path: '/legal/privacy' })
    assert.equal(checkBuiltPath('built-page', '/careers').ok, true)
    assert.equal(checkBuiltPath('built-article', '/insights/a-guide').ok, true)
    assert.equal(checkBuiltPath('built-article', '/blog/a-guide').ok, false)
    assert.equal(checkBuiltPath('built-case-study', '/our-work/kent-tiles').ok, true)
  })

  it('suggests a slug from a title', () => {
    assert.equal(slugify('What a £149/mo website includes & more'), 'what-a-149-mo-website-includes-and-more')
  })

  it('files every template under one list', () => {
    for (const template of DOCUMENT_TEMPLATES) {
      assert.ok(['pages', 'insights', 'work', 'chrome'].includes(collectionOf(template)), template)
    }
    assert.equal(collectionOf('service'), 'pages')
    assert.equal(collectionOf('built-article'), 'insights')
    assert.equal(collectionOf('footer'), 'chrome')
  })
})

describe('the overlay of a published coded document', () => {
  const baseline = {
    enabled: false,
    text: 'Baseline',
    link: undefined,
    tone: 'info',
    startsAt: '',
    endsAt: '',
  } as never

  it('takes each valid field from the overlay and keeps the baseline for the rest', () => {
    const resolved = resolveDocument('announcement', baseline, { text: 'Published', tone: 'not-a-tone' })
    assert.equal(resolved.content.text, 'Published')
    assert.equal(resolved.content.tone, 'info', 'a refused value falls back')
    assert.equal(resolved.managed, true)
    assert.ok(resolved.warnings.some(w => w.path === 'tone'))
  })

  it('renders the baseline when there is nothing published', () => {
    const resolved = resolveDocument('announcement', baseline, null)
    assert.equal(resolved.content.text, 'Baseline')
    assert.equal(resolved.managed, false)
  })

  it('every template the overlay can meet is declared', () => {
    for (const template of DOCUMENT_TEMPLATES.filter(t => !t.startsWith('built-'))) {
      assert.ok(template in TEMPLATES, template)
    }
  })
})

describe('status chips', () => {
  it('names the four states the lists show', () => {
    assert.equal(statusChip('DRAFT', 'NONE', false).label, 'Draft')
    assert.equal(statusChip('PUBLISHED', 'NONE', false).label, 'Published')
    assert.equal(statusChip('PUBLISHED', 'NONE', true).label, 'Published · draft changes')
    assert.equal(statusChip('PUBLISHED', 'IN_REVIEW', true).label, 'In review')
  })
})
