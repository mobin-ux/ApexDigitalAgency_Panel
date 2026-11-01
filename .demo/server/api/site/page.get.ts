import { createError, defineEventHandler, setResponseHeader } from 'h3'
import { z } from 'zod'
import { isDocumentTemplate, normalisePath } from '../../../shared/cms'
import prisma from '../../utils/prisma'
import { validateQuery } from '../../utils/validate'
import { publicDocument } from '../../utils/website/content'

/**
 * GET /api/site/page?path=/about — the published document at a site address
 * (ADR-026), for the public site's server. Public by design: it returns only
 * what is already live on apexdigi.co.uk. 404 when nothing is published
 * there, which the site reads as "render the code baseline".
 *
 * The address is a query parameter because a catch-all route cannot match
 * the root.
 */

const querySchema = z.object({ path: z.string().trim().min(1).max(512) })

export default defineEventHandler(async (event) => {
  const { path } = validateQuery(event, querySchema)
  const doc = await prisma.siteDocument.findUnique({
    where: { kind_key: { kind: 'page', key: normalisePath(path) } },
    include: { publishedRevision: { select: { content: true, number: true } } },
  })
  if (!doc || doc.archivedAt || !isDocumentTemplate(doc.template) || doc.status !== 'PUBLISHED' || !doc.publishedRevision) {
    throw createError({ statusCode: 404, message: 'Nothing is published at this address' })
  }
  setResponseHeader(event, 'cache-control', 'public, max-age=30')
  return publicDocument(doc, doc.publishedRevision.content, doc.publishedRevision.number)
})
