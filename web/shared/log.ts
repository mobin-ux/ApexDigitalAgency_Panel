import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { redact, redactString } from './redact.ts'

/**
 * The platform's log, one shape for both apps (the panel re-exports this
 * file by relative path; server code only).
 *
 * Every line is one JSON object (`LogRecord`): when, how severe, which app,
 * what kind of thing happened (`category`), exactly what (`event`, a
 * dot-separated name), whether it worked (`outcome`), the request it
 * belongs to (`requestId`), who did it (`actor`), and the details, passed
 * through `redact()` first. Lines go to two places:
 *
 * - stdout, as JSON in production (journald keeps it) and as a short
 *   readable line in development;
 * - a file per app per UTC day, `<dir>/<app>-YYYY-MM-DD.jsonl`, which the
 *   console's Logs screen reads and `pruneLogs()` trims.
 *
 * The request scope (request id, actor, database counters) comes from the
 * resolver the app installs at start-up, so code deep in a utility logs
 * with the request it serves without being handed the event.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error']
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export const LOG_CATEGORIES = [
  'http',
  'auth',
  'authz',
  'admin',
  'customer',
  'content',
  'db',
  'payment',
  'mail',
  'task',
  'security',
  'system',
] as const
export type LogCategory = typeof LOG_CATEGORIES[number]

export type LogOutcome = 'success' | 'failure' | 'denied' | 'skipped'

export interface LogActor {
  id?: string
  kind: 'customer' | 'staff' | 'system' | 'anonymous' | 'service'
  role?: string
  staffRole?: string
}

export interface LogHttp {
  method?: string
  path?: string
  route?: string
  status?: number
  query?: Record<string, unknown>
  bodyKeys?: string[]
  bytes?: number
  ip?: string
  userAgent?: string
  referer?: string
}

export interface LogError {
  name: string
  message: string
  statusCode?: number
  code?: string
  fields?: string[]
  stack?: string[]
}

export interface LogRecord {
  ts: string
  level: LogLevel
  app: string
  env: string
  category: LogCategory
  event: string
  message: string
  outcome?: LogOutcome
  requestId?: string
  actor?: LogActor
  http?: LogHttp
  durationMs?: number
  db?: { queries: number, ms: number, writes: number }
  error?: LogError
  data?: Record<string, unknown>
}

export interface LogInput {
  level: LogLevel
  category: LogCategory
  event: string
  message: string
  outcome?: LogOutcome
  durationMs?: number
  error?: unknown
  /** Include the stack (unexpected failures). Defaults to true for non-HTTP errors. */
  stack?: boolean
  data?: Record<string, unknown>
  actor?: LogActor
  http?: LogHttp
  requestId?: string
  db?: LogRecord['db']
}

/** What the running request contributes to every line written while it is served. */
export interface RequestScope {
  requestId: string
  startedAt: number
  actor?: LogActor
  db: { queries: number, ms: number, writes: number }
  /** The request's own failure, recorded by the error hook for the summary line. */
  error?: LogError
}

interface LogConfig {
  app: string
  env: string
  level: LogLevel
  dir: string | null
  console: 'json' | 'pretty' | 'off'
  resolveScope: () => RequestScope | undefined
}

const config: LogConfig = {
  app: 'app',
  env: process.env.NODE_ENV || 'development',
  level: 'info',
  dir: null,
  console: 'pretty',
  resolveScope: () => undefined,
}

export function configureLog(next: Partial<LogConfig>): void {
  Object.assign(config, next)
}

export function logConfig(): Readonly<LogConfig> {
  return config
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
}

export function currentScope(): RequestScope | undefined {
  try {
    return config.resolveScope()
  }
  catch {
    return undefined
  }
}

// --- Errors -------------------------------------------------------------

/**
 * A thrown value as a log may hold it: the name, the message (redacted, and
 * cut to its first line for database errors, which quote the query's
 * arguments), the HTTP status and code when it has them, the names of the
 * fields a validation failure named, and the top of the stack.
 */
export function serializeError(err: unknown, withStack = true): LogError {
  if (!(err instanceof Error) && (typeof err !== 'object' || err === null)) {
    return { name: 'NonError', message: redactString(String(err)).slice(0, 500) }
  }
  const e = err as Error & { statusCode?: number, code?: unknown, data?: unknown, cause?: unknown }
  const name = e.name || 'Error'
  let message = String(e.message ?? '')
  if (name.startsWith('PrismaClient')) {
    message = message.split('\n').map(l => l.trim()).filter(Boolean).slice(-1)[0] ?? name
  }
  const out: LogError = { name, message: redactString(message).slice(0, 500) }
  if (typeof e.statusCode === 'number') {
    out.statusCode = e.statusCode
  }
  if (typeof e.code === 'string') {
    out.code = e.code
  }
  const data = e.data as { fieldErrors?: Record<string, unknown> } | undefined
  if (data && typeof data === 'object' && data.fieldErrors && typeof data.fieldErrors === 'object') {
    out.fields = Object.keys(data.fieldErrors)
  }
  if (withStack && typeof e.stack === 'string') {
    out.stack = e.stack.split('\n').slice(1, 9).map(l => redactString(l.trim()))
  }
  return out
}

// --- Sinks --------------------------------------------------------------

let stream: fs.WriteStream | null = null
let streamDay = ''
let streamBroken = false

function dayOf(ts: string): string {
  return ts.slice(0, 10)
}

export function logFileName(app: string, day: string): string {
  return `${app}-${day}.jsonl`
}

function writeFile(line: string, ts: string): void {
  if (!config.dir || streamBroken) {
    return
  }
  const day = dayOf(ts)
  if (!stream || day !== streamDay) {
    stream?.end()
    try {
      fs.mkdirSync(config.dir, { recursive: true })
      stream = fs.createWriteStream(path.join(config.dir, logFileName(config.app, day)), { flags: 'a' })
      stream.on('error', (error) => {
        // A full disk or a permission problem must not take the app down;
        // stdout still has every line.
        streamBroken = true

        console.error(`[log] file sink stopped: ${error.message}`)
      })
      streamDay = day
    }
    catch (error) {
      streamBroken = true

      console.error(`[log] cannot open the log directory: ${(error as Error).message}`)
      return
    }
  }
  stream.write(`${line}\n`)
}

/** Ends the file stream (process shutdown). */
export function closeLog(): Promise<void> {
  return new Promise((resolve) => {
    if (!stream) {
      resolve()
      return
    }
    stream.end(() => resolve())
    stream = null
    streamDay = ''
  })
}

function writeConsole(record: LogRecord, line: string): void {
  if (config.console === 'off') {
    return
  }
  const fn = record.level === 'debug' ? 'log' : record.level
  if (config.console === 'json') {
    // eslint-disable-next-line no-console
    console[fn](line)
    return
  }
  const bits = [
    `[${record.category}] ${record.event}`,
    record.message,
    record.http?.status ? `${record.http.status}` : '',
    record.durationMs !== undefined ? `${record.durationMs}ms` : '',
    record.requestId ? `req=${record.requestId.slice(0, 8)}` : '',
    record.error ? `— ${record.error.name}: ${record.error.message}` : '',
  ].filter(Boolean)
  // eslint-disable-next-line no-console
  console[fn](bits.join(' '))
}

// --- Writing ------------------------------------------------------------

export function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[config.level]
}

/** Writes one record. Never throws: a logging failure must not fail the work being logged. */
export function writeLog(input: LogInput): void {
  if (!shouldLog(input.level)) {
    return
  }
  try {
    const scope = currentScope()
    const ts = new Date().toISOString()
    const record: LogRecord = {
      ts,
      level: input.level,
      app: config.app,
      env: config.env,
      category: input.category,
      event: input.event,
      message: redactString(input.message).slice(0, 1000),
    }
    if (input.outcome) {
      record.outcome = input.outcome
    }
    const requestId = input.requestId ?? scope?.requestId
    if (requestId) {
      record.requestId = requestId
    }
    const actor = input.actor ?? scope?.actor
    if (actor) {
      record.actor = actor
    }
    if (input.http) {
      record.http = redact(input.http) as LogHttp
    }
    if (input.durationMs !== undefined) {
      record.durationMs = Math.round(input.durationMs)
    }
    if (input.db) {
      record.db = input.db
    }
    if (input.error !== undefined) {
      const isHttp = typeof (input.error as { statusCode?: unknown })?.statusCode === 'number'
      record.error = serializeError(input.error, input.stack ?? !isHttp)
    }
    if (input.data && Object.keys(input.data).length) {
      record.data = redact(input.data) as Record<string, unknown>
    }
    const line = JSON.stringify(record)
    writeConsole(record, line)
    writeFile(line, ts)
  }
  catch (error) {
    console.error(`[log] could not write "${input.event}": ${(error as Error).message}`)
  }
}

type LevelFn = (event: string, message: string, extra?: Omit<LogInput, 'level' | 'category' | 'event' | 'message'>) => void

export interface CategoryLogger {
  debug: LevelFn
  info: LevelFn
  warn: LevelFn
  error: LevelFn
}

/** `log('auth').warn('auth.login.failed', 'Wrong password', { outcome: 'failure' })` */
export function log(category: LogCategory): CategoryLogger {
  const at = (level: LogLevel): LevelFn => (event, message, extra) => writeLog({ ...extra, level, category, event, message })
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') }
}

/**
 * Times `work` and writes one line when it ends: `<event>` with outcome
 * success and its duration, or failure with the error, which is rethrown.
 */
export async function logTimed<T>(
  category: LogCategory,
  event: string,
  message: string,
  work: () => Promise<T>,
  describe?: (result: T) => Record<string, unknown> | undefined,
): Promise<T> {
  const started = performance.now()
  try {
    const result = await work()
    writeLog({ level: 'info', category, event, message, outcome: 'success', durationMs: performance.now() - started, data: describe?.(result) })
    return result
  }
  catch (error) {
    writeLog({ level: 'error', category, event, message: `${message} failed`, outcome: 'failure', durationMs: performance.now() - started, error })
    throw error
  }
}

// --- Retention and reading ----------------------------------------------

/** Deletes this app's log files older than `days`. Returns the names removed. */
export function pruneLogs(days: number, now = Date.now()): string[] {
  if (!config.dir || !fs.existsSync(config.dir)) {
    return []
  }
  const cutoff = new Date(now - days * 86_400_000).toISOString().slice(0, 10)
  const removed: string[] = []
  const pattern = new RegExp(`^${config.app}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl$`)
  for (const name of fs.readdirSync(config.dir)) {
    const day = name.match(pattern)?.[1]
    if (day && day < cutoff) {
      fs.rmSync(path.join(config.dir, name), { force: true })
      removed.push(name)
    }
  }
  return removed
}

export interface LogQuery {
  /** Days to read, newest first (UTC, YYYY-MM-DD). */
  days: string[]
  /** Where each app writes; the panel reads its own directory and the site's. */
  sources: { app: string, dir: string }[]
  minLevel?: LogLevel
  category?: LogCategory
  event?: string
  outcome?: LogOutcome
  requestId?: string
  actorId?: string
  status?: 'ok' | '4xx' | '5xx'
  text?: string
  /** Only records strictly older than this timestamp (paging). */
  before?: string
  limit: number
}

/** Largest slice of one file read back, from its end. */
const READ_CAP_BYTES = 32 * 1024 * 1024

function readLines(file: string): string[] {
  const size = fs.statSync(file).size
  const start = Math.max(0, size - READ_CAP_BYTES)
  const fd = fs.openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(size - start)
    fs.readSync(fd, buffer, 0, buffer.length, start)
    const lines = buffer.toString('utf8').split('\n')
    if (start > 0) {
      lines.shift()
    }
    return lines
  }
  finally {
    fs.closeSync(fd)
  }
}

function matches(r: LogRecord, q: LogQuery): boolean {
  if (q.minLevel && LEVEL_ORDER[r.level] < LEVEL_ORDER[q.minLevel]) {
    return false
  }
  if (q.category && r.category !== q.category) {
    return false
  }
  if (q.event && !r.event.startsWith(q.event)) {
    return false
  }
  if (q.outcome && r.outcome !== q.outcome) {
    return false
  }
  if (q.requestId && r.requestId !== q.requestId) {
    return false
  }
  if (q.actorId && r.actor?.id !== q.actorId) {
    return false
  }
  if (q.status) {
    const s = r.http?.status
    if (!s || (q.status === 'ok' && s >= 400) || (q.status === '4xx' && (s < 400 || s >= 500)) || (q.status === '5xx' && s < 500)) {
      return false
    }
  }
  if (q.before && r.ts >= q.before) {
    return false
  }
  return true
}

/**
 * Reads records back from the files, newest first, across apps. Text
 * search matches the raw line, so it also finds a value inside `data`.
 */
export function readLogs(q: LogQuery): { items: LogRecord[], scanned: number, more: boolean } {
  const items: LogRecord[] = []
  let scanned = 0
  const needle = q.text?.toLowerCase()
  for (const day of q.days) {
    const batch: LogRecord[] = []
    for (const { app, dir } of q.sources) {
      const file = path.join(dir, logFileName(app, day))
      if (!fs.existsSync(file)) {
        continue
      }
      for (const line of readLines(file)) {
        if (!line) {
          continue
        }
        scanned++
        if (needle && !line.toLowerCase().includes(needle)) {
          continue
        }
        let record: LogRecord
        try {
          record = JSON.parse(line) as LogRecord
        }
        catch {
          continue
        }
        if (matches(record, q)) {
          batch.push(record)
        }
      }
    }
    batch.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    for (const record of batch) {
      if (items.length === q.limit) {
        return { items, scanned, more: true }
      }
      items.push(record)
    }
  }
  return { items, scanned, more: false }
}
