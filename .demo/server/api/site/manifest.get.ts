import { defineEventHandler, setResponseHeader } from 'h3'
import { DOCUMENT_TEMPLATES, isBuiltTemplate, seoOf } from '../../../shared/cms'
import prisma from '../../utils/prisma'
import { parseContent } from '../../utils/website/content'

/**
 * GET /api/site/manifest — every published page address (ADR-026), for the
 * site's sitemap and for listing the articles and case studies built in the
 * console beside the ones in its code. A built document carries its list
 * meta (summary, category, sector …) so the Insights and Our work lists can
 * show it without reading each page.
 */
export default defineEventHandler(async (event) => {
  const docs = await prisma.siteDocument.findMany({
    where: { kind: 'page', template: { in: DOCUMENT_TEMPLATES }, status: 'PUBLISHED', archivedAt: null, publishedRevisionId: { not: null } },
    include: { publishedRevision: { select: { content: true } } },
    orderBy: { publishedAt: 'desc' },
  })
  setResponseHeader(event, 'cache-control', 'public, max-age=30')
  return {
    pages: docs.map((d) => {
      const content = parseContent(d.publishedRevision!.content) as { meta?: Record<string, unknown> } | null
      const built = isBuiltTemplate(d.template)
      return {
        key: d.key,
        template: d.template,
        title: d.title,
        publishedAt: d.publishedAt?.toISOString() ?? null,
        built,
        noindex: seoOf(content).robots.startsWith('noindex'),
        meta: built ? content?.meta ?? null : null,
      }
    }),
  }
})
