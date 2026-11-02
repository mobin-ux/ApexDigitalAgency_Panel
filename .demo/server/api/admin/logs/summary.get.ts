import type { LogRecord } from '../../../../shared/log'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { readLogs } from '../../../../shared/log'
import { daysBack, logSources } from '../../../utils/log-sources'
import { requireStaffPermission } from '../../../utils/permissions'
import { validateQuery } from '../../../utils/validate'

/**
 * GET /api/admin/logs/summary — what the log says over a few days, for the
 * top of System › Logs: lines by level, category and outcome; the warning
 * and error events that recur, with how often and when last; requests by
 * route with their failures and timings; and the slowest requests. Owner
 * only (`platform.settings`), like the lines themselves.
 */
const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(14).default(1),
})

const SCAN_LIMIT = 250_000

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'platform.settings')
  const { date, days } = validateQuery(event, querySchema)
  const end = date ?? new Date().toISOString().slice(0, 10)
  const { items, scanned, more } = readLogs({ days: daysBack(end, days), sources: logSources(), limit: SCAN_LIMIT })

  const byLevel = new Map<string, number>()
  const byCategory = new Map<string, number>()
  const byOutcome = new Map<string, number>()
  const problems = new Map<string, { event: string, level: string, message: string, count: number, last: string, requestId?: string }>()
  const routes = new Map<string, { route: string, count: number, failures: number, serverErrors: number, totalMs: number, maxMs: number }>()
  const slow: LogRecord[] = []

  for (const r of items) {
    bump(byLevel, r.level)
    bump(byCategory, r.category)
    if (r.outcome) {
      bump(byOutcome, r.outcome)
    }
    if (r.level === 'warn' || r.level === 'error') {
      const message = r.error ? `${r.error.name}: ${r.error.message}` : r.message
      const key = `${r.app}|${r.event}|${r.event === 'http.request' ? `${r.http?.route ?? r.http?.path} ${r.http?.status}` : message}`
      const p = problems.get(key)
      if (p) {
        p.count++
      }
      else {
        // Items are newest first, so the first one seen is the latest.
        problems.set(key, { event: `${r.app}:${r.event}`, level: r.level, message: r.event === 'http.request' ? `${r.http?.method} ${r.http?.route ?? r.http?.path} → ${r.http?.status}` : message, count: 1, last: r.ts, requestId: r.requestId })
      }
    }
    if (r.event === 'http.request' && r.http) {
      const key = `${r.app} ${r.http.method} ${r.http.route ?? r.http.path}`
      const s = routes.get(key) ?? { route: key, count: 0, failures: 0, serverErrors: 0, totalMs: 0, maxMs: 0 }
      s.count++
      if ((r.http.status ?? 0) >= 400) {
        s.failures++
      }
      if ((r.http.status ?? 0) >= 500) {
        s.serverErrors++
      }
      s.totalMs += r.durationMs ?? 0
      s.maxMs = Math.max(s.maxMs, r.durationMs ?? 0)
      routes.set(key, s)
      if (slow.length < 10 || (r.durationMs ?? 0) > (slow.at(-1)?.durationMs ?? 0)) {
        slow.push(r)
        slow.sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
        slow.length = Math.min(slow.length, 10)
      }
    }
  }

  const entries = (m: Map<string, number>) => Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]))
  return {
    from: daysBack(end, days).at(-1),
    to: end,
    lines: items.length,
    scanned,
    truncated: more,
    byLevel: entries(byLevel),
    byCategory: entries(byCategory),
    byOutcome: entries(byOutcome),
    problems: [...problems.values()].sort((a, b) => b.count - a.count).slice(0, 50),
    routes: [...routes.values()]
      .map(s => ({ ...s, avgMs: Math.round(s.totalMs / s.count), maxMs: Math.round(s.maxMs), totalMs: undefined }))
      .sort((a, b) => b.failures - a.failures || b.count - a.count)
      .slice(0, 60),
    slowest: slow.map(r => ({ ts: r.ts, app: r.app, requestId: r.requestId, method: r.http?.method, path: r.http?.path, status: r.http?.status, durationMs: r.durationMs, db: r.db })),
  }
})
