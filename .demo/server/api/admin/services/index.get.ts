import { defineEventHandler } from 'h3'
import { DEFAULT_CATALOG, DEFAULT_FROM_PRICES } from '../../../utils/catalog'
import { requireStaffPermission } from '../../../utils/permissions'
import { getSettings } from '../../../utils/settings'

/**
 * GET /api/admin/services — the editable New Order catalogue: the list of
 * services, each service's plans (tiers, prices, features) and the home-page
 * "from" prices. Backed by the same Setting rows that `/api/config` serves to
 * customers, merged over the canonical defaults so the editor is always full.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'work.view')

  const s = await getSettings({
    'catalog.services': DEFAULT_CATALOG,
    'catalog.from-prices': DEFAULT_FROM_PRICES,
  })

  const catalog = s['catalog.services'] as typeof DEFAULT_CATALOG

  return {
    services: catalog?.services ?? [],
    plans: catalog?.plans ?? {},
    fromPrices: s['catalog.from-prices'] ?? DEFAULT_FROM_PRICES,
  }
})
