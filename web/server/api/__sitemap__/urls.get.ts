import type { ServiceSlug } from '../../../app/data/routes'
import { publishedArticles } from '../../../app/data/articles'
import { allCaseStudies } from '../../../app/data/case-studies'
import { routes } from '../../../app/data/routes'
import { servicePagePaths } from '../../../app/data/service-pages'

/**
 * Every address the sitemap lists: the code pages, with only the case
 * studies that have a written story and only the written articles (the
 * rest are `noindex` summaries or not pages at all).
 */
export default defineEventHandler(() => {
  const fixed = [routes.home, routes.services, routes.ourWork, routes.insights, routes.about, routes.contact]
  const dynamic = [
    ...servicePagePaths.map(slug => routes.service(slug as ServiceSlug)),
    ...allCaseStudies.filter(s => s.story).map(s => routes.caseStudy(s.slug)),
    ...publishedArticles.map(a => routes.article(a.slug)),
  ]
  return [...fixed, ...dynamic].map(loc => ({ loc }))
})
