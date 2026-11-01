import { z } from 'zod'
import { addDays, VISIT_OTHER_PATH, visitDay, VISITS_MAX_BUCKETS } from '../../../shared/visits'
import prisma from '../prisma'

/**
 * Website analytics (ADR-026, phase F): the visit totals the site counts
 * itself and sends here once a minute, and the report the Analytics screen
 * and the Overview read. Enquiry and order figures come from their own
 * records. Nothing here is about a person: the totals carry no identifier.
 */

export const ANALYTICS_PERIODS = [7, 14, 30, 90] as const
export type AnalyticsPeriod = typeof ANALYTICS_PERIODS[number]

/** The batch the site sends, checked again here: the signature proves who sent it, not that it is well formed. */
export const visitBatchSchema = z.object({
  id: z.string().uuid(),
  buckets: z.array(z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    path: z.string().min(1).max(200).refine(p => p === VISIT_OTHER_PATH || p.startsWith('/'), 'A site path'),
    source: z.string().max(80),
    views: z.number().int().min(0).max(1_000_000),
    visits: z.number().int().min(0).max(1_000_000),
  })).max(VISITS_MAX_BUCKETS),
})

/*
 * Batches already counted, by id, for a little longer than a signature
 * stays valid: a call retried after its answer was lost is counted once.
 * A restart forgets them, which only matters for a retry inside the same
 * five minutes.
 */
const seen = new Map<string, number>()
const SEEN_MS = 10 * 60_000

export async function recordVisitBatch(batch: z.infer<typeof visitBatchSchema>, now = Date.now()): Promise<{ counted: number, duplicate?: true }> {
  for (const [id, at] of seen) {
    if (now - at > SEEN_MS) {
      seen.delete(id)
    }
  }
  if (seen.has(batch.id)) {
    return { counted: 0, duplicate: true }
  }
  seen.set(batch.id, now)
  const rows = batch.buckets.filter(b => b.views > 0 || b.visits > 0)
  await prisma.$transaction(rows.map(b => prisma.siteVisit.upsert({
    where: { day_path_source: { day: b.day, path: b.path, source: b.source } },
    create: b,
    update: { views: { increment: b.views }, visits: { increment: b.visits } },
  })))
  return { counted: rows.length }
}

function top<T>(totals: Map<string, number>, n: number, make: (key: string, value: number) => T): T[] {
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k, v]) => make(k, v))
}

function tally(map: Map<string, number>, key: string, n: number): void {
  map.set(key, (map.get(key) ?? 0) + n)
}

/** The last `days` London days up to today: visits per day, pages, sources, and the enquiries and orders from records. */
export async function analyticsReport(days: AnalyticsPeriod, now = new Date()) {
  const to = visitDay(now)
  const from = addDays(to, -(days - 1))
  const [rows, first, recent, orders] = await Promise.all([
    prisma.siteVisit.findMany({ where: { day: { gte: from, lte: to } }, select: { day: true, path: true, source: true, views: true, visits: true } }),
    prisma.siteVisit.findFirst({ orderBy: { day: 'asc' }, select: { day: true } }),
    // A day either side of the range in UTC, then kept by London day.
    prisma.enquiry.findMany({
      where: { receivedAt: { gte: new Date(`${addDays(from, -1)}T00:00:00Z`) } },
      select: { receivedAt: true, status: true, source: true },
    }),
    prisma.project.count(),
  ])
  const firstDay = first?.day ?? null

  const perDay = new Map<string, { views: number, visits: number }>()
  const pages = new Map<string, number>()
  const sources = new Map<string, number>()
  let views = 0
  let visits = 0
  for (const r of rows) {
    const d = perDay.get(r.day) ?? { views: 0, visits: 0 }
    d.views += r.views
    d.visits += r.visits
    perDay.set(r.day, d)
    views += r.views
    visits += r.visits
    tally(pages, r.path, r.views)
    if (r.visits) {
      tally(sources, r.source || 'Direct', r.visits)
    }
  }
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i)
    return { day, ...(perDay.get(day) ?? { views: 0, visits: 0 }), counted: firstDay !== null && day >= firstDay }
  })

  const sourceRows = top(sources, 6, (source, n) => ({ source, visits: n }))
  const rest = visits - sourceRows.reduce((sum, s) => sum + s.visits, 0)
  if (rest > 0) {
    sourceRows.push({ source: 'Other', visits: rest })
  }

  const enquiries = recent.filter((e) => {
    const day = visitDay(e.receivedAt)
    return day >= from && day <= to
  })
  const byPage = new Map<string, number>()
  for (const e of enquiries) {
    tally(byPage, e.source.split('?', 1)[0] || 'Not recorded', 1)
  }

  return {
    days,
    from,
    to,
    firstDay,
    totals: { views, visits },
    series,
    pages: top(pages, 8, (path, n) => ({ path, views: n })),
    sources: sourceRows,
    enquiries: {
      received: enquiries.length,
      won: enquiries.filter(e => e.status === 'won').length,
      byPage: top(byPage, 8, (path, count) => ({ path, count })),
    },
    orders,
  }
}
