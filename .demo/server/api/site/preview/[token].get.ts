import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { isDocumentTemplate } from '../../../../shared/cms'
import { readPurposeToken } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { PREVIEW_PURPOSE, publicDocument, withMedia } from '../../../utils/website/content'

/**
 * GET /api/site/preview/:token — a document's current draft, for the site's
 * /preview page (ADR-026). The token is a 30-minute purpose token signed by
 * the console for someone who could see the document; without a valid one
 * this answers 404, the same as an address with nothing on it. Never cached.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const token = getRouterParam(event, 'token') ?? ''
  const claims = token ? readPurposeToken(event, token, PREVIEW_PURPOSE) : null
  const id = typeof claims?.doc === 'string' ? claims.doc : null
  const doc = id ? await prisma.siteDocument.findUnique({ where: { id }, include: { publishedRevision: { select: { number: true } } } }) : null
  if (!doc || doc.archivedAt || doc.kind !== 'page' || !isDocumentTemplate(doc.template)) {
    throw createError({ statusCode: 404, message: 'This preview link has expired or does not exist' })
  }
  return { ...await withMedia(publicDocument(doc, doc.draft, doc.publishedRevision?.number ?? null)), preview: true }
})
