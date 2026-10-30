import { defineEventHandler } from 'h3'
import { DEFAULT_CATALOG } from '../../../../shared/catalog'
import { getCatalog } from '../../../utils/catalog-v2'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/services — the Panel v2 catalogue (ADR-019) as the New order
 * wizard and `POST /api/orders` read it, plus the shipped defaults so the
 * editor can offer "reset to default" per plan.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'work.view')
  // Admin console (2026-10-31): the catalogue table shows how many live
  // projects each service has, so a price change is read against them.
  const live = await prisma.project.groupBy({
    by: ['serviceId'],
    where: { serviceId: { not: null }, status: { in: ['PENDING', 'IN_PROGRESS', 'IN_REVIEW'] } },
    _count: { _all: true },
  })
  return {
    catalog: await getCatalog(),
    defaults: DEFAULT_CATALOG,
    live: Object.fromEntries(live.map(row => [row.serviceId, row._count._all])) as Record<string, number>,
  }
})
