import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { TEMPLATE_KEYS, validateContent } from '../../shared/cms/index.ts'

/**
 * Every fixed baseline document must pass its own template, or the site
 * would throw at render. The module imports the data layer through the `~`
 * alias, which Node cannot resolve, so it is loaded through the alias map
 * the site's tsconfig describes: `~` is `app/`.
 */
describe('code baseline documents', () => {
  it('declares templates for every page the site renders from code', () => {
    for (const key of ['home', 'services', 'our-work', 'insights', 'about', 'contact', 'service', 'case-study', 'article', 'header', 'footer', 'service-chrome', 'case-study-chrome', 'article-chrome']) {
      assert.ok(TEMPLATE_KEYS.includes(key as never), key)
    }
  })

  it('the landing seo object the baseline helper builds passes the seo schema', () => {
    const result = validateContent('landing', { title: 'x', sections: [], seo: { title: '', description: '', canonical: '', robots: 'index,follow', ogTitle: '', ogDescription: '' } })
    assert.equal(result.ok, true)
  })
})
