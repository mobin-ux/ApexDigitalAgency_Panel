import type { Prisma } from '@prisma/client'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { can } from '../../../../shared/permissions'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { assignableStaff } from '../../../utils/staff'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/projects — paginated project directory across all customers.
 * Query: ?page=&pageSize=&search=&status=&category=&userId=
 *
 * Phase 9 (Overview & work) adds three things, all additive:
 *
 * - `statusCounts`, so the stage tabs carry live counts of the whole
 *   directory rather than of whatever page happens to be loaded (badge 4:
 *   "62 rows want filters with counts and a stated total, not a pager");
 * - `unassigned`, the one number the header sub-line needs and no filter
 *   on this endpoint can express;
 * - `assignable`, the staff the bulk-assign dialog offers, so selecting
 *   rows does not cost a second round trip.
 *
 * The counts deliberately ignore `status` — a tab strip whose counts move
 * when you press a tab cannot be used to compare stages — but do respect
 * search, category and owner, which are narrowing the same set.
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  category: z.string().trim().max(100).optional(),
  userId: z.string().trim().max(64).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaffPermission(event, 'work.view')
  const { page, pageSize, search, status, category, userId } = validateQuery(event, querySchema)

  /*
   * Built as "everything except the stage", then narrowed — rather than
   * built whole and the stage deleted back out. A clone-and-delete leaves
   * the stage optional in the type of a filter that must not carry one,
   * and the counts silently following the selected tab is precisely the
   * bug badge 4 is about.
   */
  const baseWhere: Prisma.ProjectWhereInput = {
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { id: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }

  const where = { ...baseWhere, ...(status ? { status } : {}) }

  /*
   * `groupBy` sits outside the transaction on purpose: inside a
   * `$transaction([...])` array Prisma widens `by` to `string[]`, which
   * drops the overload that types `_count` as a number and leaves the
   * counts as `boolean | {...}`. These are five independent reads, so
   * there is nothing for the transaction to protect anyway.
   */
  const byStatus = await prisma.project.groupBy({ by: ['status'], where: baseWhere, _count: true })

  const [items, total, categories, unassigned] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        manager: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { milestones: true, files: true } },
      },
    }),
    prisma.project.count({ where }),
    // Distinct categories power the filter dropdown without a second request.
    prisma.project.findMany({ select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } }),
    prisma.project.count({ where: { ...baseWhere, managerId: null, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
  ])

  const statusCounts = Object.fromEntries(byStatus.map(row => [row.status, row._count]))
  const canMoney = can(session.staffRole, 'money.view')

  /*
   * The contract value is money. Blanking it in the template would leave
   * the real figure in the page payload for anyone who opens dev tools —
   * a gate the reader can see through is not a gate — so it is dropped
   * here and the column renders an em dash.
   */
  const rows = items.map(item => ({ ...item, amount: canMoney ? item.amount : null }))

  return {
    ...paginated(rows, total, { page, pageSize }),
    categories: categories.map(c => c.category),
    statusCounts,
    allCount: byStatus.reduce((sum, row) => sum + row._count, 0),
    unassigned,
    assignable: await assignableStaff(),
    canMoney,
  }
})
