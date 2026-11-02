import process from 'node:process'
import { PrismaClient } from '@prisma/client'
import { currentScope, writeLog } from '../../shared/log'

/**
 * Shared PrismaClient singleton — every server route must use this
 * instead of instantiating its own client.
 *
 * In development, Nitro hot-reloads route modules on every change; a
 * per-module `new PrismaClient()` would leak one connection pool per
 * reload. Caching the instance on `globalThis` survives HMR. In
 * production the module is evaluated once, so a plain instance is fine.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * The schema names the database literally (`file:./dev.db`, resolved next to
 * the schema), so the environment cannot normally move it. The CMS test
 * suites run a dev server against a *copy* of the local database, and need
 * to: an absolute `DATABASE_URL` (`file:/abs/path.db` or a Windows drive)
 * overrides the schema's path. A relative value is ignored on purpose —
 * Prisma would resolve it against the working directory, which differs
 * between the dev server and the CLI, and silently open a second, empty
 * database.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  return url && /^file:(?:\/|[A-Za-z]:[\\/])/.test(url) ? url : undefined
}

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  '$executeRaw',
  '$executeRawUnsafe',
])
/** Writes that happen on most requests (last-seen stamps) are debug, not info. */
const ROUTINE_WRITES = new Set(['Session'])
const SLOW_QUERY_MS = Number(process.env.NUXT_LOG_SLOW_QUERY_MS) || 200

/** What a write's result may tell the log: the row id, or how many rows. Never the row. */
function writeResult(result: unknown): Record<string, unknown> {
  if (result && typeof result === 'object') {
    const r = result as { id?: unknown, count?: unknown }
    if (typeof r.count === 'number') {
      return { count: r.count }
    }
    if (typeof r.id === 'string' || typeof r.id === 'number') {
      return { id: r.id }
    }
    if (Array.isArray(result)) {
      return { count: result.length }
    }
  }
  return typeof result === 'number' ? { count: result } : {}
}

/**
 * The client with the platform log around every operation (shared/log.ts):
 * each query adds to the request's counters (shown on its `http.request`
 * line), each write is a `db.<operation>` line with the model, the row id or
 * the row count and the time it took, a read slower than `SLOW_QUERY_MS` is
 * a `db.slow` warning, and a failure is `db.error` (a known request error,
 * such as a unique-constraint clash a caller expects and handles, is a
 * warning). Arguments and results are never logged. Interactive
 * transactions inherit the extension, so writes inside one are logged too.
 */
function instrument(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const started = performance.now()
        const write = WRITE_OPERATIONS.has(operation)
        const name = model ? `${model}.${operation}` : operation
        try {
          const result = await query(args)
          const ms = performance.now() - started
          const scope = currentScope()
          if (scope) {
            scope.db.queries++
            scope.db.ms += ms
            if (write) {
              scope.db.writes++
            }
          }
          if (write) {
            const detail = writeResult(result)
            writeLog({
              // A write that touched nothing (an empty prune) is not news.
              level: (model && ROUTINE_WRITES.has(model)) || detail.count === 0 ? 'debug' : 'info',
              category: 'db',
              event: `db.${operation}`,
              message: name,
              outcome: 'success',
              durationMs: ms,
              data: { model, operation, ...detail },
            })
          }
          else if (ms >= SLOW_QUERY_MS) {
            writeLog({ level: 'warn', category: 'db', event: 'db.slow', message: `${name} took ${Math.round(ms)}ms`, durationMs: ms, data: { model, operation } })
          }
          return result
        }
        catch (error) {
          const known = (error as Error)?.name === 'PrismaClientKnownRequestError'
          writeLog({
            level: known ? 'warn' : 'error',
            category: 'db',
            event: 'db.error',
            message: `${name} failed`,
            outcome: 'failure',
            durationMs: performance.now() - started,
            error,
            stack: !known,
            data: { model, operation },
          })
          throw error
        }
      },
    },
  }) as unknown as PrismaClient
}

const prisma = globalForPrisma.prisma ?? instrument(new PrismaClient(datasourceUrl() ? { datasourceUrl: datasourceUrl() } : undefined))

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
