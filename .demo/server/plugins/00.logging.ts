import type { H3Event } from 'h3'
import type { LogHttp, LogLevel, LogOutcome, RequestScope } from '../../shared/log'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { getQuery, getRequestHeader, getRequestIP, getResponseHeader, setResponseHeader } from 'h3'
import { closeLog, configureLog, isLogLevel, serializeError, writeLog } from '../../shared/log'
import { maskIp } from '../../shared/redact'
import { getAuthSession } from '../utils/auth'
import { actorOf } from '../utils/logger'

/**
 * The panel's request log (the platform log is `shared/log.ts`).
 *
 * - Configures the log from runtime config: `NUXT_LOG_DIR` (default
 *   `.data/logs` beside the process), `NUXT_LOG_LEVEL` (default `info`,
 *   `debug` in development), JSON on stdout in production.
 * - Gives every request a scope: an id (also sent back as `X-Request-Id`,
 *   and added to the `data` of an API error so a person reporting one can
 *   quote it), the actor once known, and database counters the Prisma
 *   instrumentation fills in. Nitro's async context makes the scope
 *   reachable from any code serving the request.
 * - Writes one `http.request` line per request when it ends: method, path,
 *   route, status, duration, bytes, the query (redacted), the names of the
 *   body's fields (never their values), the masked client address, the
 *   actor, how many queries it ran and for how long, and the error if it
 *   failed. 5xx is `error`, 4xx `warn`, the rest `info`; static assets and
 *   Nuxt internals are `debug`.
 * - Writes `http.exception` with the stack for every unexpected failure.
 */

const QUIET_PATH = /^\/(?:_nuxt\/|__nuxt|_ipx\/|fonts\/|brand\/|img\/|icons\/|favicon|api\/_test\/|_nitro\/)/
const REQUEST_ID = /^[\w-]{8,64}$/

function scopeOf(event: H3Event): RequestScope | undefined {
  return event.context.$log as RequestScope | undefined
}

function httpOf(event: H3Event, status: number): LogHttp {
  const url = event.node.req.originalUrl || event.path || '/'
  const query = getQuery(event)
  const http: LogHttp = {
    method: event.method,
    path: url.split('?')[0],
    status,
  }
  const route = (event.context.matchedRoute as { path?: string } | undefined)?.path
  if (route) {
    http.route = route
  }
  if (Object.keys(query).length) {
    http.query = Object.fromEntries(Object.entries(query).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 120) : v]))
  }
  const keys = event.context.$logBodyKeys as string[] | undefined
  if (keys?.length) {
    http.bodyKeys = keys
  }
  const bytes = Number(getResponseHeader(event, 'content-length'))
  if (Number.isFinite(bytes) && bytes > 0) {
    http.bytes = bytes
  }
  const ip = maskIp(getRequestIP(event, { xForwardedFor: true }))
  if (ip) {
    http.ip = ip
  }
  const ua = getRequestHeader(event, 'user-agent')
  if (ua) {
    http.userAgent = ua.slice(0, 160)
  }
  return http
}

function levelFor(status: number, quiet: boolean, slow: boolean): LogLevel {
  // 503 is the deliberate answer of maintenance mode or an unconfigured
  // feature; anything else at 5xx is a failure.
  if (status >= 500 && status !== 503) {
    return 'error'
  }
  if (status === 503) {
    return 'warn'
  }
  if (status >= 400) {
    return quiet ? 'debug' : 'warn'
  }
  if (slow) {
    return 'warn'
  }
  return quiet ? 'debug' : 'info'
}

function outcomeFor(status: number): LogOutcome {
  if (status === 401 || status === 403) {
    return 'denied'
  }
  return status >= 400 ? 'failure' : 'success'
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const logConfig = (config.log ?? {}) as { dir?: string, level?: string, slowRequestMs?: number | string }
  const level = isLogLevel(logConfig.level) ? logConfig.level : (import.meta.dev ? 'debug' : 'info')
  const slowRequestMs = Number(logConfig.slowRequestMs) || 1500

  configureLog({
    app: 'panel',
    env: import.meta.dev ? 'development' : (process.env.NODE_ENV || 'production'),
    level,
    dir: path.resolve(logConfig.dir || '.data/logs'),
    console: import.meta.dev ? 'pretty' : 'json',
    resolveScope: () => {
      try {
        return scopeOf(useEvent())
      }
      catch {
        // No request is being served (a scheduled task, start-up).
        return undefined
      }
    },
  })

  writeLog({
    level: 'info',
    category: 'system',
    event: 'system.start',
    message: 'Panel server started',
    data: { node: process.version, pid: process.pid, level },
  })

  nitroApp.hooks.hook('request', (event) => {
    const incoming = getRequestHeader(event, 'x-request-id')
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID()
    const scope: RequestScope = { requestId, startedAt: performance.now(), db: { queries: 0, ms: 0, writes: 0 } }
    event.context.$log = scope
    setResponseHeader(event, 'X-Request-Id', requestId)
  })

  /** The request's summary line; written once, by whichever of the two hooks sees the end. */
  function summarise(event: H3Event, status: number, error?: unknown) {
    const scope = scopeOf(event)
    if (!scope || (scope as { done?: boolean }).done) {
      return
    }
    (scope as { done?: boolean }).done = true
    const http = httpOf(event, status)
    const durationMs = performance.now() - scope.startedAt
    // HEAD probes (uptime checks, the preview pane) are debug like assets.
    const quiet = QUIET_PATH.test(http.path ?? '') || http.method === 'HEAD'
    let actor = scope.actor
    if (!actor) {
      try {
        const session = getAuthSession(event)
        actor = session ? actorOf(session) : { kind: 'anonymous' }
      }
      catch {
        actor = { kind: 'anonymous' }
      }
    }
    writeLog({
      level: levelFor(status, quiet, durationMs > slowRequestMs),
      category: 'http',
      event: 'http.request',
      message: `${http.method} ${http.path} → ${status}${durationMs > slowRequestMs ? ' (slow)' : ''}`,
      outcome: outcomeFor(status),
      requestId: scope.requestId,
      actor,
      http,
      durationMs,
      db: { queries: scope.db.queries, ms: Math.round(scope.db.ms), writes: scope.db.writes },
      ...(error ? { error, stack: status >= 500 } : {}),
    })
  }

  nitroApp.hooks.hook('afterResponse', (event) => {
    summarise(event, event.node.res.statusCode)
  })

  nitroApp.hooks.hook('error', (error, context) => {
    const event = context.event as H3Event | undefined
    const e = error as Error & { statusCode?: number, unhandled?: boolean, data?: unknown }
    const status = typeof e.statusCode === 'number' ? e.statusCode : 500
    // A thrown HTTP error with a status the code chose (other than a failure
    // to answer) is an outcome; an unhandled throw or a 500/502/504 is a fault.
    const unexpected = e.unhandled === true || (status >= 500 && status !== 503)
    if (!event) {
      writeLog({ level: 'error', category: 'system', event: 'system.exception', message: e.message || 'Unhandled error', outcome: 'failure', error, stack: true, data: { tags: context.tags } })
      return
    }
    const scope = scopeOf(event)
    if (scope) {
      scope.error = serializeError(error, unexpected)
      // A person who sees the error can quote this id; it finds every line of the request.
      if (event.path.startsWith('/api/') && (e.data === undefined || (typeof e.data === 'object' && e.data !== null && !Array.isArray(e.data)))) {
        e.data = { ...(e.data as object | undefined), requestId: scope.requestId }
      }
    }
    if (unexpected) {
      writeLog({
        level: 'error',
        category: 'http',
        event: 'http.exception',
        message: `${event.method} ${event.path}: ${e.message || 'Internal error'}`,
        outcome: 'failure',
        requestId: scope?.requestId,
        error,
        stack: true,
        data: { tags: context.tags },
      })
    }
    // An error response is sent by the error handler, which ends the
    // request without `afterResponse`; a failure inside `afterResponse` itself
    // is not the request's answer.
    if (!(context.tags as string[] | undefined)?.includes('response')) {
      summarise(event, status, error)
    }
  })

  nitroApp.hooks.hook('close', async () => {
    writeLog({ level: 'info', category: 'system', event: 'system.stop', message: 'Panel server stopping' })
    await closeLog()
  })
})
