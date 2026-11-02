#!/usr/bin/env node
/**
 * Reads the platform log (shared/log.ts JSON-lines files) and writes a
 * Markdown report: totals by level, category and outcome; every error and
 * warning grouped by what happened, with a count, the first and last time
 * and example request ids; the routes that failed, by status; the slowest
 * requests and queries; requests that ran many queries; and a scan for
 * anything that looks like a secret or personal data that slipped past the
 * redaction.
 *
 *   node scripts/log-report.mjs --dir .demo/.data/logs --dir web/.data/logs \
 *     [--since 2026-11-02T10:00:00Z] [--until …] [--out report.md] [--json out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
function opt(name) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : args[i + 1]
}
function opts(name) {
  return args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []))
}

const dirs = opts('dir')
if (!dirs.length) {
  console.error('usage: log-report.mjs --dir <log dir> [--dir …] [--since ISO] [--until ISO] [--out file.md] [--json file.json]')
  process.exit(2)
}
const since = opt('since') ?? ''
const until = opt('until') ?? '9999'
const SLOW_REQUEST_MS = Number(opt('slow-request-ms') ?? 1500)
const MANY_QUERIES = Number(opt('many-queries') ?? 25)

const records = []
let unreadable = 0
for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    continue
  }
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.jsonl')).sort()) {
    for (const line of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
      if (!line) {
        continue
      }
      try {
        const r = JSON.parse(line)
        if (r.ts >= since && r.ts <= until) {
          r.__raw = line
          records.push(r)
        }
      }
      catch {
        unreadable++
      }
    }
  }
}
records.sort((a, b) => (a.ts < b.ts ? -1 : 1))

function count(list, key) {
  return list.reduce((m, r) => {
    const k = key(r) ?? '—'
    m[k] = (m[k] ?? 0) + 1
    return m
  }, {})
}

// Problems: warnings and errors grouped by what happened.
const groups = new Map()
for (const r of records.filter(r => r.level === 'warn' || r.level === 'error')) {
  const what = r.event === 'http.request'
    ? `${r.http?.method} ${r.http?.route ?? r.http?.path} → ${r.http?.status}${r.error?.message ? ` (${r.error.message})` : ''}`
    : r.error ? `${r.error.name}: ${r.error.message}` : r.message
  const key = `${r.app}|${r.level}|${r.event}|${what}`
  const g = groups.get(key) ?? { app: r.app, level: r.level, event: r.event, what, count: 0, first: r.ts, last: r.ts, requestIds: [], stack: r.error?.stack?.slice(0, 4), category: r.category }
  g.count++
  g.last = r.ts
  if (r.requestId && g.requestIds.length < 3 && !g.requestIds.includes(r.requestId)) {
    g.requestIds.push(r.requestId)
  }
  groups.set(key, g)
}
const problems = [...groups.values()].sort((a, b) => (a.level === b.level ? b.count - a.count : a.level === 'error' ? -1 : 1))

const requests = records.filter(r => r.event === 'http.request' && r.http)
const routes = new Map()
for (const r of requests) {
  const key = `${r.app} ${r.http.method} ${r.http.route ?? r.http.path}`
  const s = routes.get(key) ?? { key, count: 0, statuses: {}, total: 0, max: 0, queries: 0 }
  s.count++
  s.statuses[r.http.status] = (s.statuses[r.http.status] ?? 0) + 1
  s.total += r.durationMs ?? 0
  s.max = Math.max(s.max, r.durationMs ?? 0)
  s.queries = Math.max(s.queries, r.db?.queries ?? 0)
  routes.set(key, s)
}
const failingRoutes = [...routes.values()].filter(s => Object.keys(s.statuses).some(st => Number(st) >= 400)).sort((a, b) => b.count - a.count)
const slowRequests = requests.filter(r => (r.durationMs ?? 0) >= SLOW_REQUEST_MS).sort((a, b) => b.durationMs - a.durationMs).slice(0, 25)
const manyQueries = requests.filter(r => (r.db?.queries ?? 0) >= MANY_QUERIES).sort((a, b) => b.db.queries - a.db.queries).slice(0, 25)
const slowQueries = records.filter(r => r.event === 'db.slow').sort((a, b) => b.durationMs - a.durationMs).slice(0, 25)
const exceptions = records.filter(r => r.event === 'http.exception' || r.event === 'system.exception')

// Leak scan: patterns the redaction is meant to remove.
const LEAKS = [
  ['email address', /"[^"]*\b[\w.%+-]{2,}@[\w-]+\.[\w.-]+\b[^"]*"/],
  ['JWT', /eyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/],
  ['password value', /"(?:password|newPassword|currentPassword)":"(?!\[redacted\])[^"]+"/i],
  ['bearer token', /Bearer [\w.~+/-]{8,}/],
  ['card number', /\b(?:\d[ -]?){13,19}\b/],
  ['full IPv4 address', /"ip":"\d{1,3}\.\d{1,3}\.\d{1,3}\.(?!0")\d{1,3}"/],
]
const leaks = []
for (const r of records) {
  for (const [label, re] of LEAKS) {
    const m = r.__raw.match(re)
    if (!m) {
      continue
    }
    if (label === 'card number') {
      const digits = m[0].replace(/\D/g, '')
      let sum = 0
      let dbl = false
      for (let i = digits.length - 1; i >= 0; i--) {
        let d = Number(digits[i])
        if (dbl) {
          d *= 2
          if (d > 9) {
            d -= 9
          }
        }
        sum += d
        dbl = !dbl
      }
      if (sum % 10 !== 0) {
        continue
      }
    }
    if (label === 'email address' && /\*\*\*@/.test(m[0])) {
      continue
    }
    leaks.push({ label, ts: r.ts, app: r.app, event: r.event, requestId: r.requestId, sample: m[0].slice(0, 120) })
  }
}

const span = records.length ? `${records[0].ts} → ${records.at(-1).ts}` : 'no records'
const md = []
function table(head, rows) {
  md.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`)
  for (const row of rows) {
    md.push(`| ${row.map(c => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`)
  }
  md.push('')
}
md.push(`# Log report`, '', `${records.length} lines from ${dirs.join(', ')}; ${span}.${unreadable ? ` ${unreadable} unreadable lines.` : ''}`, '')
md.push('## Totals', '')
table(['By level', 'Lines'], Object.entries(count(records, r => r.level)))
table(['By category', 'Lines'], Object.entries(count(records, r => r.category)).sort((a, b) => b[1] - a[1]))
table(['By outcome', 'Lines'], Object.entries(count(records, r => r.outcome)).sort((a, b) => b[1] - a[1]))
md.push(`## Exceptions (${exceptions.length})`, '')
table(['When', 'App', 'Event', 'Error', 'Request', 'Top of stack'], exceptions.map(r => [r.ts, r.app, r.event, `${r.error?.name}: ${r.error?.message}`, r.requestId, (r.error?.stack ?? []).slice(0, 2).join(' / ')]))
md.push(`## Warnings and errors, grouped (${problems.length})`, '')
table(['Level', 'App', 'Event', 'What', 'Count', 'First', 'Last', 'Requests'], problems.map(p => [p.level, p.app, p.event, p.what, p.count, p.first, p.last, p.requestIds.join(' ')]))
md.push(`## Routes that answered 4xx or 5xx (${failingRoutes.length})`, '')
table(['Route', 'Requests', 'Statuses', 'Avg ms', 'Max ms'], failingRoutes.map(s => [s.key, s.count, Object.entries(s.statuses).map(([k, v]) => `${k}×${v}`).join(' '), Math.round(s.total / s.count), Math.round(s.max)]))
md.push(`## Slow requests (≥ ${SLOW_REQUEST_MS} ms)`, '')
table(['When', 'Request', 'Status', 'ms', 'DB queries', 'DB ms', 'Request id'], slowRequests.map(r => [r.ts, `${r.app} ${r.http.method} ${r.http.path}`, r.http.status, r.durationMs, r.db?.queries, r.db?.ms, r.requestId]))
md.push(`## Requests with ≥ ${MANY_QUERIES} queries`, '')
table(['When', 'Request', 'Queries', 'DB ms', 'Request id'], manyQueries.map(r => [r.ts, `${r.app} ${r.http.method} ${r.http.path}`, r.db.queries, r.db.ms, r.requestId]))
md.push('## Slow queries', '')
table(['When', 'Query', 'ms', 'Request id'], slowQueries.map(r => [r.ts, r.message, r.durationMs, r.requestId]))
md.push(`## Possible leaks (${leaks.length})`, '')
table(['Kind', 'When', 'App', 'Event', 'Sample', 'Request id'], leaks.slice(0, 50).map(l => [l.label, l.ts, l.app, l.event, l.sample, l.requestId]))

const out = opt('out')
if (out) {
  fs.writeFileSync(out, md.join('\n'))
}
else {
  console.log(md.join('\n'))
}
const json = opt('json')
if (json) {
  fs.writeFileSync(json, JSON.stringify({ span, lines: records.length, problems, failingRoutes, slowRequests: slowRequests.map(({ __raw, ...r }) => r), manyQueries: manyQueries.map(({ __raw, ...r }) => r), slowQueries: slowQueries.map(({ __raw, ...r }) => r), exceptions: exceptions.map(({ __raw, ...r }) => r), leaks }, null, 2))
}
console.error(`log-report: ${records.length} lines, ${problems.length} problem groups, ${exceptions.length} exceptions, ${leaks.length} possible leaks`)
