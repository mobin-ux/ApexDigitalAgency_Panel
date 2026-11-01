import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { ENQUIRY_FILTERS } from '../../../../../shared/enquiry-status'
import { can } from '../../../../../shared/permissions'
import { paginationQuerySchema } from '../../../../utils/http'
import { staffHolding } from '../../../../utils/notify'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateQuery } from '../../../../utils/validate'
import { namesOf } from '../../../../utils/website/content'
import { filterWhere, summariseAll } from '../../../../utils/website/enquiries'

/**
 * GET /api/admin/website/enquiries — the Enquiries list (`Admin
 * Console.dc.html` `v_43leads`): newest first, the design's filters (Open ·
 * New · Contacted · Qualified · Won · Lost) with counts over everything
 * stored, an optional search over name, business and email, and the staff
 * an enquiry can be given to (everyone holding `leads.handle`).
 */

const querySchema = paginationQuerySchema.extend({
  filter: z.enum(ENQUIRY_FILTERS).default('open'),
  q: z.string().trim().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'leads.handle')
  const query = validateQuery(event, querySchema)
  const search = query.q ? { OR: [{ name: { contains: query.q } }, { business: { contains: query.q } }, { email: { contains: query.q } }] } : {}
  const where = { ...filterWhere(query.filter), ...search }

  const [rows, total, grouped, ownerIds] = await Promise.all([
    prisma.enquiry.findMany({ where, orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.enquiry.count({ where }),
    prisma.enquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    staffHolding('leads.handle'),
  ])
  const byStatus = Object.fromEntries(grouped.map(g => [g.status, g._count._all])) as Record<string, number>
  const counts = Object.fromEntries(ENQUIRY_FILTERS.map(f => [f, f === 'open'
    ? (byStatus.new ?? 0) + (byStatus.contacted ?? 0) + (byStatus.qualified ?? 0)
    : byStatus[f] ?? 0]))
  const owners = await namesOf(ownerIds)

  return {
    items: await summariseAll(rows),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    counts,
    owners: [...owners].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    canConvert: can(actor.staffRole, 'clients.approve'),
  }
})
