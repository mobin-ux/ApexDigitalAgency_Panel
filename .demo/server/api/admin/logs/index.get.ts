import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { LOG_CATEGORIES, LOG_LEVELS, readLogs } from '../../../../shared/log'
import { daysBack, logSources } from '../../../utils/log-sources'
import { requireStaffPermission } from '../../../utils/permissions'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/logs — the platform log, newest first (System › Logs).
 * Owner only (`platform.settings`): lines carry request paths, account ids
 * and masked addresses. Filters: the day it ends on and how many days back
 * (at most 14), app, minimum level, category, event prefix, outcome,
 * request id, actor id, HTTP status class and free text. `before` pages
 * back from the oldest line already shown.
 */
const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(14).default(1),
  app: z.enum(['all', 'panel', 'site']).default('all'),
  level: z.enum(LOG_LEVELS as [string, ...string[]]).optional(),
  category: z.enum(LOG_CATEGORIES).optional(),
  event: z.string().trim().max(80).optional(),
  outcome: z.enum(['success', 'failure', 'denied', 'skipped']).optional(),
  requestId: z.string().trim().max(64).optional(),
  actorId: z.string().trim().max(64).optional(),
  status: z.enum(['ok', '4xx', '5xx']).optional(),
  q: z.string().trim().max(120).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(10).max(500).default(200),
})

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'platform.settings')
  const q = validateQuery(event, querySchema)
  const end = q.date ?? new Date().toISOString().slice(0, 10)
  const sources = logSources().filter(s => q.app === 'all' || s.app === q.app)
  const result = readLogs({
    days: daysBack(end, q.days),
    sources,
    minLevel: q.level as never,
    category: q.category,
    event: q.event || undefined,
    outcome: q.outcome,
    requestId: q.requestId || undefined,
    actorId: q.actorId || undefined,
    status: q.status,
    text: q.q || undefined,
    before: q.before,
    limit: q.limit,
  })
  return { ...result, apps: sources.map(s => s.app), from: daysBack(end, q.days).at(-1), to: end }
})
