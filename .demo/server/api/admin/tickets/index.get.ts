import type { ReplyPriority } from '../../../../shared/support-eta'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { DEFAULT_REPLY_TARGETS, REPLY_PRIORITIES, replyTargetKey } from '../../../../shared/support-eta'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/tickets — support inbox across all customers.
 * Query: ?page=&pageSize=&search=&status=&priority=&assignee=
 * `assignee` accepts a user id, "me", or "unassigned".
 * Status/priority are free-text schema fields (matches the customer page's
 * keyword normalization) so they're filtered as case-insensitive contains.
 */

const querySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  priority: z.string().trim().max(40).optional(),
  assignee: z.string().trim().max(64).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'support.answer')
  const { page, pageSize, search, status, priority, assignee } = validateQuery(event, querySchema)

  const where = {
    ...(status ? { status: { contains: status } } : {}),
    ...(priority ? { priority: { contains: priority } } : {}),
    ...(assignee === 'unassigned'
      ? { assigneeId: null }
      : assignee === 'me'
        ? { assigneeId: admin.id }
        : assignee
          ? { assigneeId: assignee }
          : {}),
    ...(search
      ? {
          OR: [
            { subject: { contains: search } },
            { id: { contains: search } },
            { user: { email: { contains: search } } },
          ],
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      ...toSkipTake({ page, pageSize }),
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, isAdmin: true, isInternal: true, createdAt: true },
        },
      },
    }),
    prisma.ticket.count({ where }),
  ])

  /*
   * Admin console (2026-10-31): the inbox measures each open request
   * against the reply promise for its priority, so the list carries the
   * targets (Platform settings, else the defaults) and, per ticket, when
   * the customer's unanswered message arrived. Internal notes are not an
   * answer, so they are skipped when finding the latest public message.
   */
  const [targetRows, latest] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: REPLY_PRIORITIES.map(replyTargetKey) } } }),
    Promise.all(items.map(t => prisma.ticketMessage.findFirst({
      where: { ticketId: t.id, isInternal: false },
      orderBy: { createdAt: 'desc' },
      select: { isAdmin: true, createdAt: true },
    }))),
  ])
  const replyTargets = Object.fromEntries(REPLY_PRIORITIES.map((p) => {
    const row = targetRows.find(r => r.key === replyTargetKey(p))
    return [p, Number(row?.value) || DEFAULT_REPLY_TARGETS[p]]
  })) as Record<ReplyPriority, number>

  const rows = items.map((t, i) => ({
    ...t,
    waitingSince: latest[i] && !latest[i]!.isAdmin ? latest[i]!.createdAt : null,
  }))

  return { ...paginated(rows, total, { page, pageSize }), replyTargets }
})
