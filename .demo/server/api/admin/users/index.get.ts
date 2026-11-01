import type { Prisma } from '@prisma/client'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { can } from '../../../../shared/permissions'
import { orderFor, paginated, paginationQuerySchema, sortQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/users — paginated, searchable customer directory.
 * Query: ?page=&pageSize=&search=&role=&status=&accountType=&sort=&dir=
 * (sort: name | created)
 * Exemplar for every future admin list endpoint: requireStaffPermission →
 * validated query → shared prisma → `paginated()` envelope.
 *
 * A list carries only what its rows show (ADR-025, UK GDPR data
 * minimisation): name, one contact (the phone only for an account with no
 * email), status, company, counts, last active, and the credit line for
 * money roles. Addresses, balances and verification dates stay on the
 * client's record.
 */

const SORTS: Record<string, (dir: 'asc' | 'desc') => Prisma.UserOrderByWithRelationInput> = {
  name: (dir: 'asc' | 'desc') => ({ firstName: dir }),
  created: (dir: 'asc' | 'desc') => ({ createdAt: dir }),
}

const querySchema = paginationQuerySchema.merge(sortQuerySchema(['name', 'created'])).extend({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN', 'EMPLOYEE']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  // Account type is derived, not stored: a user with a Company row is a
  // company account, everyone else is an individual.
  accountType: z.enum(['individual', 'company']).optional(),
})

export default defineEventHandler(async (event) => {
  const staff = await requireStaffPermission(event, 'work.view')
  const canMoney = can(staff.staffRole, 'money.view')
  const { page, pageSize, search, role, status, accountType, sort, dir } = validateQuery(event, querySchema)

  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(accountType === 'company' ? { company: { isNot: null } } : {}),
    ...(accountType === 'individual' ? { company: { is: null } } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { company: { name: { contains: search } } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: orderFor(SORTS, sort, dir, { sort: 'created', dir: 'desc' }),
      // Explicit select — the password hash must never leave the server.
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatar: true,
        createdAt: true,
        company: { select: { id: true, name: true, status: true } },
        _count: { select: { projects: true, tickets: true } },
        // Admin console (2026-10-31): the Clients table's "Credit line" and
        // "Last active" columns. The line is only selected for a role that
        // may see money, so it never reaches a browser that would hide it.
        ...(canMoney ? { creditLine: { select: { status: true, limit: true, used: true } } } : {}),
        sessions: { orderBy: { lastSeenAt: 'desc' }, take: 1, select: { lastSeenAt: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const rows = items.map(u => ({ ...u, phone: u.email ? null : u.phone }))
  return { ...paginated(rows, total, { page, pageSize }), canMoney }
})
