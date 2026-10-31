import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { can } from '../../../../shared/permissions'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/users — paginated, searchable customer directory.
 * Query: ?page=&pageSize=&search=&role=
 * Exemplar for every future admin list endpoint: requireStaffPermission →
 * validated query → shared prisma → `paginated()` envelope.
 */

const querySchema = paginationQuerySchema.extend({
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
  const { page, pageSize, search, role, status, accountType } = validateQuery(event, querySchema)

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
      orderBy: { createdAt: 'desc' },
      // Explicit select — the password hash must never leave the server.
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        verifiedAt: true,
        avatar: true,
        city: true,
        country: true,
        walletBalance: true,
        adCredits: true,
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

  return { ...paginated(items, total, { page, pageSize }), canMoney }
})
