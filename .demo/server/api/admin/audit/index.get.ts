import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { AUDIT_KINDS, kindFilter } from '../../../../shared/audit-kinds'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/audit — the privileged-action trail, paginated.
 * Query: ?page=&pageSize=&search=&action=&targetType=&kind=
 * `action` matches as a prefix (e.g. "admin.user." covers every user verb).
 *
 * Phase 9 adds, without removing anything the previous callers read:
 * - `kind`, the Access/Team/Money/Work/Config bucket from
 *   `shared/audit-kinds.ts`, filtered with that module's own include and
 *   exclude prefixes so the query and the chip cannot disagree;
 * - the actor's name, resolved from the id, so the log can show a person
 *   rather than only an address;
 * - `roleAtTime` and `reason`, which the audit screen shows verbatim
 *   (badge 30). Both are null on rows written before this phase, and the
 *   screen renders that as absent rather than inventing a value.
 *
 * Read-only by construction: there is no PATCH or DELETE anywhere on this
 * resource. An audit log you can amend is not an audit log.
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  action: z.string().trim().max(100).optional(),
  targetType: z.string().trim().max(50).optional(),
  kind: z.enum(AUDIT_KINDS).optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'team.manage')
  const { page, pageSize, search, action, targetType, kind } = validateQuery(event, querySchema)

  const kindWhere = (() => {
    if (!kind) {
      return {}
    }
    const { matchAll, include, exclude } = kindFilter(kind)
    return {
      AND: [
        // The catch-all bucket has no include list: it is everything the
        // other buckets do not claim.
        ...(matchAll ? [] : [{ OR: include.map(prefix => ({ action: { startsWith: prefix } })) }]),
        ...exclude.map(prefix => ({ NOT: { action: { startsWith: prefix } } })),
      ],
    }
  })()

  const where = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(targetType ? { targetType } : {}),
    ...kindWhere,
    ...(search
      ? {
          OR: [
            { actorEmail: { contains: search } },
            { targetId: { contains: search } },
            { action: { contains: search } },
            { reason: { contains: search } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ])

  // One extra query rather than a relation: `actorId` has no foreign key
  // (auth events are recorded for accounts that may not exist), so the
  // name is resolved best-effort and simply absent when it cannot be.
  const actors = await prisma.user.findMany({
    where: { id: { in: [...new Set(items.map(i => i.actorId))] } },
    select: { id: true, firstName: true, lastName: true },
  })
  const nameById = new Map(actors.map(a => [a.id, [a.firstName, a.lastName].filter(Boolean).join(' ')]))

  return paginated(
    items.map(item => ({ ...item, actorName: nameById.get(item.actorId) || null })),
    total,
    { page, pageSize },
  )
})
