import type { ServiceSlug } from '../../../app/data/routes'
import { publishedArticles } from '../../../app/data/articles'
import { allCaseStudies } from '../../../app/data/case-studies'
import { routes } from '../../../app/data/routes'
import { servicePagePaths } from '../../../app/data/service-pages'
import { fetchManifest } from '../../utils/cms'

/**
 * Every address the sitemap lists: the code pages (only the case studies
 * with a written story and only the written articles; the rest are
 * `noindex` summaries or not pages at all), plus the pages, articles and
 * case studies published from the admin console (ADR-026). A page the
 * console has set to noindex is left out, and its publish time is the
 * entry's `lastmod`.
 */
export default defineEventHandler(async () => {
  const fixed = [routes.home, routes.services, routes.ourWork, routes.insights, routes.about, routes.contact]
  const dynamic = [
    ...servicePagePaths.map(slug => routes.service(slug as ServiceSlug)),
    ...allCaseStudies.filter(s => s.story).map(s => routes.caseStudy(s.slug)),
    ...publishedArticles.map(a => routes.article(a.slug)),
  ]
  const manifest = await fetchManifest()
  const published = new Map(manifest.map(entry => [entry.key, entry]))
  const code = [...fixed, ...dynamic]
    .filter(loc => !published.get(loc)?.noindex)
    .map(loc => ({ loc, ...(published.get(loc)?.publishedAt ? { lastmod: published.get(loc)!.publishedAt! } : {}) }))
  const built = manifest
    .filter(entry => entry.built && !entry.noindex)
    .map(entry => ({ loc: entry.key, ...(entry.publishedAt ? { lastmod: entry.publishedAt } : {}) }))
  return [...code, ...built]
})
