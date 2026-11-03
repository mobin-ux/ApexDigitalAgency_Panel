import { defineEventHandler } from 'h3'
import { collectionOf, isDocumentTemplate } from '../../../shared/cms'
import { can } from '../../../shared/permissions'
import { requireStaff } from '../../utils/permissions'
import prisma from '../../utils/prisma'

/**
 * GET /api/admin/nav-counts — the live counts on the console's sidebar rows,
 * in one call: open support requests, credit applications to decide,
 * website documents in review per list, and enquiries nobody has contacted.
 *
 * The sidebar used to ask four endpoints for these on every navigation, one
 * of them the Overview's whole statistics for a single number. Each count
 * here is a plain count, and one the role could not open is left out, so a
 * caller learns nothing its role does not already show it.
 */
/** The sidebar's count keys this route answers (`AdminCountKey` in app/utils/adminNav.ts). */
type CountKey = 'support' | 'credit' | 'pages' | 'insights' | 'work' | 'leads'

export default defineEventHandler(async (event) => {
  const { staffRole } = await requireStaff(event)
  const counts: Partial<Record<CountKey, number>> = {}
  const jobs: Promise<unknown>[] = []

  if (can(staffRole, 'support.answer') && can(staffRole, 'work.view')) {
    jobs.push(prisma.ticket.count({ where: { status: 'OPEN' } }).then((n) => {
      counts.support = n
    }))
  }
  if (can(staffRole, 'money.view')) {
    jobs.push(prisma.creditApplication.count({ where: { status: 'SUBMITTED' } }).then((n) => {
      counts.credit = n
    }))
  }
  if (can(staffRole, 'website.publish')) {
    jobs.push(prisma.siteDocument.groupBy({ by: ['template'], where: { review: 'IN_REVIEW', archivedAt: null }, _count: { _all: true } }).then((rows) => {
      counts.pages = 0
      counts.insights = 0
      counts.work = 0
      for (const row of rows) {
        const collection = isDocumentTemplate(row.template) ? collectionOf(row.template) : 'chrome'
        if (collection !== 'chrome') {
          counts[collection] = (counts[collection] ?? 0) + row._count._all
        }
      }
    }))
  }
  if (can(staffRole, 'leads.handle')) {
    jobs.push(prisma.enquiry.count({ where: { status: 'new' } }).then((n) => {
      counts.leads = n
    }))
  }

  await Promise.all(jobs)
  return counts
})
