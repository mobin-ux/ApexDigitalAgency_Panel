import type { AnalyticsPeriod } from '../../../utils/website/analytics'
import { defineEventHandler, getQuery } from 'h3'
import { requireStaffPermission } from '../../../utils/permissions'
import { ANALYTICS_PERIODS, analyticsReport } from '../../../utils/website/analytics'

/**
 * GET /api/admin/website/analytics?days=7|14|30|90 — the Analytics screen
 * (30 by default) and the Overview's "Website visits" (14). Totals only:
 * visits, page views, pages, sources, and enquiry and order counts.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'analytics.view')
  const asked = Number(getQuery(event).days)
  const days = (ANALYTICS_PERIODS as readonly number[]).includes(asked) ? asked as AnalyticsPeriod : 30
  return analyticsReport(days)
})
