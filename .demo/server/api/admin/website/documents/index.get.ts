import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { templatesIn } from '../../../../../shared/cms'
import { paginated, paginationQuerySchema, sortQuerySchema } from '../../../../utils/http'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateQuery } from '../../../../utils/validate'
import { DOCUMENT_INCLUDE, namesOf, summarise } from '../../../../utils/website/content'

/**
 * GET /api/admin/website/documents — the Pages, Insights and Case studies
 * lists (ADR-026). `?collection=` picks the list; `?filter=` is the design's
 * All · Published · In review · Drafts, where Drafts also counts published
 * documents carrying unpublished changes. The counts on the filter pills
 * come back with every answer, over the whole collection.
 *
 * Collections are a few dozen rows, and "has draft changes" compares the
 * draft with the live revision, so the filter and the page are applied
 * after reading the collection rather than in the query.
 */

const querySchema = paginationQuerySchema.merge(sortQuerySchema(['updated', 'title', 'path'])).extend({
  collection: z.enum(['pages', 'insights', 'work', 'chrome']),
  filter: z.enum(['all', 'published', 'review', 'draft']).default('all'),
  q: z.string().trim().max(120).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const query = validateQuery(event, querySchema)

  const docs = await prisma.siteDocument.findMany({
    where: { template: { in: templatesIn(query.collection) }, archivedAt: null },
    include: DOCUMENT_INCLUDE,
  })
  const names = await namesOf(docs.flatMap(d => [d.draftUpdatedById, d.submittedById]))
  let rows = docs.map(d => summarise(d, names))

  const needle = query.q?.toLowerCase()
  if (needle) {
    rows = rows.filter(r => r.title.toLowerCase().includes(needle) || (r.path ?? '').includes(needle))
  }

  const matches = {
    all: () => true,
    published: (r: typeof rows[number]) => r.status === 'PUBLISHED' && r.review === 'NONE',
    review: (r: typeof rows[number]) => r.review === 'IN_REVIEW',
    draft: (r: typeof rows[number]) => r.status === 'DRAFT' || r.dirty,
  }
  const counts = {
    all: rows.length,
    published: rows.filter(matches.published).length,
    review: rows.filter(matches.review).length,
    draft: rows.filter(matches.draft).length,
  }
  rows = rows.filter(matches[query.filter])

  const dir = query.dir ?? (query.sort && query.sort !== 'updated' ? 'asc' : 'desc')
  const key = query.sort ?? 'updated'
  const value = (r: typeof rows[number]) => key === 'title' ? r.title.toLowerCase() : key === 'path' ? r.path ?? '' : r.updatedAt
  rows.sort((a, b) => {
    const order = value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : a.id.localeCompare(b.id)
    return dir === 'asc' ? order : -order
  })

  const start = (query.page - 1) * query.pageSize
  return { ...paginated(rows.slice(start, start + query.pageSize), rows.length, query), counts }
})
