import { z } from 'zod'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { DEAD_ON_RETRY, MAIL_STATUSES } from '../../../utils/mail/outbox'
import { MAIL_ENV_KEYS, mailConfigured, mailRuntime } from '../../../utils/mail/transport'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'

const querySchema = paginationQuerySchema.extend({
  status: z.enum(MAIL_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
})

/**
 * GET /api/admin/mail — the outbox (ADR-022): whether sending is
 * configured, the counts the Email screen's tiles show, and a page of
 * messages. The rendered text and HTML are never returned: a reset or
 * invite email carries a live token, and the screen has no need of the body.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'team.manage')
  const { page, pageSize, status, q } = validateQuery(event, querySchema)

  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ to: { contains: q } }, { subject: { contains: q } }] } : {}),
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000)

  const [total, rows, queued, failed, sent24h] = await Promise.all([
    prisma.mailMessage.count({ where }),
    prisma.mailMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake({ page, pageSize }),
      select: { id: true, to: true, toUserId: true, kind: true, subject: true, status: true, attempts: true, lastError: true, providerId: true, nextAttemptAt: true, sentAt: true, createdAt: true },
    }),
    prisma.mailMessage.count({ where: { status: { in: ['QUEUED', 'SENDING'] } } }),
    prisma.mailMessage.count({ where: { status: 'FAILED' } }),
    prisma.mailMessage.count({ where: { status: 'SENT', sentAt: { gte: dayAgo } } }),
  ])

  return {
    configured: mailConfigured(),
    from: mailRuntime().from,
    envKeys: MAIL_ENV_KEYS,
    counts: { queued, failed, sent24h },
    ...paginated(
      rows.map(row => ({ ...row, retryable: row.status === 'FAILED' && !DEAD_ON_RETRY.has(row.kind) })),
      total,
      { page, pageSize },
    ),
  }
})
