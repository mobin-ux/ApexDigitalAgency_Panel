import type { TemplateKey } from '#shared/cms'
import { TEMPLATES, validateContent } from '#shared/cms'
import { publishedArticles } from '../../../app/data/articles'
import { allCaseStudies } from '../../../app/data/case-studies'
import { articleBaseline, caseStudyBaseline, fixedBaselines, serviceBaseline } from '../../../app/data/cms-baseline'
import { routes } from '../../../app/data/routes'
import { loadServicePage, servicePagePaths } from '../../../app/data/service-pages'

/**
 * The code baseline as documents (ADR-021): one per fixed template and one
 * per service page, case study and written article. The panel's importer
 * reads this to create the first revision of every document, so staff edit
 * what the site shows today rather than an empty form. Nothing here is
 * secret: it is the text of the public pages.
 *
 * Every document is validated against its template before it leaves; a
 * baseline that fails is a code bug and answers 500 rather than a document
 * the panel would then refuse to save.
 */

export interface BaselineDocument {
  kind: 'page' | 'global'
  template: TemplateKey
  key: string
  title: string
  content: unknown
}

class BaselineInvalid extends Error {}

function document(template: TemplateKey, key: string, title: string, content: unknown): BaselineDocument {
  const check = validateContent(template, content)
  if (!check.ok) {
    throw new BaselineInvalid(`${template} ${key}: ${check.issues.map(i => `${i.path}: ${i.message}`).join('; ')}`)
  }
  return { kind: TEMPLATES[template].kind === 'global' ? 'global' : 'page', template, key, title, content: check.content }
}

export default defineCachedEventHandler(async () => {
  const docs: BaselineDocument[] = []

  for (const [template, content] of Object.entries(fixedBaselines) as [keyof typeof fixedBaselines, unknown][]) {
    const def = TEMPLATES[template]
    docs.push(document(template, def.fixedKey ?? template, def.label, content))
  }

  for (const slug of servicePagePaths) {
    const page = await loadServicePage(slug)
    if (page) {
      docs.push(document('service', routes.service(page.slug), page.hero.title, serviceBaseline(page)))
    }
  }

  for (const study of allCaseStudies) {
    docs.push(document('case-study', routes.caseStudy(study.slug), study.story?.title ?? `${study.client} case study`, caseStudyBaseline(study)))
  }

  for (const article of publishedArticles) {
    docs.push(document('article', routes.article(article.slug), article.title, articleBaseline(article)))
  }

  return { version: 1, documents: docs }
}, { maxAge: 60, name: 'cms-baseline', getKey: () => 'all' })
