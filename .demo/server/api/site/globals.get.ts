import { defineEventHandler, setResponseHeader } from 'h3'
import { DOCUMENT_TEMPLATES } from '../../../shared/cms'
import prisma from '../../utils/prisma'
import { publicDocument } from '../../utils/website/content'

/**
 * GET /api/site/globals — the published site chrome (header, footer,
 * announcement and the words shared by every service, case study and
 * article page), keyed by template (ADR-026). Public: all of it is on every
 * page of the live site already.
 */
export default defineEventHandler(async (event) => {
  const docs = await prisma.siteDocument.findMany({
    where: { kind: 'global', template: { in: DOCUMENT_TEMPLATES }, status: 'PUBLISHED', archivedAt: null, publishedRevisionId: { not: null } },
    include: { publishedRevision: { select: { content: true, number: true } } },
  })
  setResponseHeader(event, 'cache-control', 'public, max-age=30')
  return {
    globals: Object.fromEntries(docs.filter(d => d.publishedRevision).map(d => [d.template, publicDocument(d, d.publishedRevision!.content, d.publishedRevision!.number)])),
  }
})
