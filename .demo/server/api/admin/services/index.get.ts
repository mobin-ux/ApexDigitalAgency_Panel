import { defineEventHandler } from 'h3'
import { DEFAULT_CATALOG } from '../../../../shared/catalog'
import { getCatalog } from '../../../utils/catalog-v2'
import { requireStaffPermission } from '../../../utils/permissions'

/**
 * GET /api/admin/services — the Panel v2 catalogue (ADR-019) as the New order
 * wizard and `POST /api/orders` read it, plus the shipped defaults so the
 * editor can offer "reset to default" per plan.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'work.view')
  return { catalog: await getCatalog(), defaults: DEFAULT_CATALOG }
})
