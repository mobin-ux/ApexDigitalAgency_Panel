import { defineEventHandler } from 'h3'
import { collectionOf, isDocumentTemplate } from '../../../../shared/cms'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/website/review-counts — documents waiting for review per
 * collection, for the counts on the Pages, Insights and Case studies rows
 * of the console's sidebar (ADR-026).
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const rows = await prisma.siteDocument.groupBy({ by: ['template'], where: { review: 'IN_REVIEW', archivedAt: null }, _count: { _all: true } })
  const counts = { pages: 0, insights: 0, work: 0 }
  for (const row of rows) {
    if (!isDocumentTemplate(row.template)) {
      continue
    }
    const collection = collectionOf(row.template)
    if (collection !== 'chrome') {
      counts[collection] += row._count._all
    }
  }
  return counts
})
