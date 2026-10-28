import { z } from 'zod'
import { DISPLAY_STATUSES, TEMPLATE_KEYS } from '../../../../../shared/cms'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../../utils/http'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateQuery } from '../../../../utils/validate'
import { summarise, WITH_PUBLISHED } from '../../../../utils/website/documents'

const querySchema = paginationQuerySchema.extend({
  kind: z.enum(['page', 'global', 'panel']).optional(),
  template: z.enum(TEMPLATE_KEYS as [string, ...string[]]).optional(),
  state: z.enum(DISPLAY_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
})

/**
 * The documents list. The display state is derived per row (it folds two
 * columns and a pointer), so a state filter is applied after the query on
 * the page's worth of candidates: the list is small enough for that to be
 * honest, and the counts the screen shows are of the whole directory.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const { page, pageSize, kind, template, state, q } = validateQuery(event, querySchema)

  const where = {
    ...(kind ? { kind } : {}),
    ...(template ? { template } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { key: { contains: q } }] } : {}),
  }

  if (state) {
    const rows = await prisma.siteDocument.findMany({ where, include: WITH_PUBLISHED, orderBy: { draftUpdatedAt: 'desc' } })
    const matching = rows.map(summarise).filter(row => row.state === state)
    const { skip, take } = toSkipTake({ page, pageSize })
    return paginated(matching.slice(skip, skip + take), matching.length, { page, pageSize })
  }

  const [rows, total] = await prisma.$transaction([
    prisma.siteDocument.findMany({ where, include: WITH_PUBLISHED, orderBy: { draftUpdatedAt: 'desc' }, ...toSkipTake({ page, pageSize }) }),
    prisma.siteDocument.count({ where }),
  ])
  return paginated(rows.map(summarise), total, { page, pageSize })
})
