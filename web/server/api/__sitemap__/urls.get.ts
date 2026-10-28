import type { ServiceSlug } from '../../../app/data/routes'
import { publishedArticles } from '../../../app/data/articles'
import { allCaseStudies } from '../../../app/data/case-studies'
import { routes } from '../../../app/data/routes'
import { servicePagePaths } from '../../../app/data/service-pages'
import { fetchManifest } from '../../utils/cms'

/**
 * Every address the sitemap lists: the code pages (only case studies with a
 * written story, only written articles) and the published landing pages
 * that are not hidden from search, with the panel's publish time as
 * lastmod where one exists. Drafts and previews never appear.
 */
export default defineEventHandler(async () => {
  const manifest = await fetchManifest()
  const published = new Map(manifest.map(p => [p.key, p]))
  const fixed = [routes.home, routes.services, routes.ourWork, routes.insights, routes.about, routes.contact]
  const dynamic = [
    ...servicePagePaths.map(slug => routes.service(slug as ServiceSlug)),
    ...allCaseStudies.filter(s => s.story).map(s => routes.caseStudy(s.slug)),
    ...publishedArticles.map(a => routes.article(a.slug)),
  ]
  const code = [...fixed, ...dynamic].filter(loc => !published.get(loc)?.noindex)
  const landing = manifest.filter(p => p.landing && !p.noindex).map(p => p.key)
  return [...code, ...landing].map(loc => ({ loc, lastmod: published.get(loc)?.publishedAt ?? undefined }))
})
