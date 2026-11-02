import type { LogHttp, LogLevel, LogOutcome, RequestScope } from '#shared/log'
import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import { STATUS_CODES } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { closeLog, configureLog, isLogLevel, serializeError, writeLog } from '#shared/log'
import { maskIp } from '#shared/redact'
import { getQuery, getRequestHeader, getRequestIP, getResponseHeader, setResponseHeader } from 'h3'

/**
 * The site's request log, on the platform log (`shared/log.ts`), the same
 * shape the console writes: one `http.request` line per request with the
 * path, status, duration, masked client address and the error when it
 * failed, plus `http.exception` with the stack for an unexpected failure.
 * Files go to `NUXT_LOG_DIR` (default `.data/logs`), one per day; the
 * console's Logs screen reads them when the panel's `NUXT_LOG_SITE_DIR`
 * points here. Visitors are anonymous: no cookie or session is read.
 */

const QUIET_PATH = /^\/(?:_nuxt\/|__nuxt|_ipx\/|fonts\/|brand\/|img\/|icons\/|favicon|_nitro\/|api\/hit$)/
const REQUEST_ID = /^[\w-]{8,64}$/

function scopeOf(event: H3Event): RequestScope | undefined {
  return event.context.$log as RequestScope | undefined
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
  const config = (useRuntimeConfig().log ?? {}) as { dir?: string, level?: string, slowRequestMs?: number | string }

  // An error thrown without a statusMessage went out as "Server Error" whatever
  // its status, 404s included (AUD-06): give it the standard reason phrase
  // before the error handler writes the response.
  const handleError = nitroApp.h3App.options.onError
  nitroApp.h3App.options.onError = (error, event) => {
    if (!error.statusMessage && STATUS_CODES[error.statusCode]) {
      error.statusMessage = STATUS_CODES[error.statusCode]!
    }
    return handleError?.(error, event)
  }
  const level = isLogLevel(config.level) ? config.level : (import.meta.dev ? 'debug' : 'info')
  const slowRequestMs = Number(config.slowRequestMs) || 1500

  configureLog({
    app: 'site',
    env: import.meta.dev ? 'development' : (process.env.NODE_ENV || 'production'),
    level,
    dir: path.resolve(config.dir || '.data/logs'),
    console: import.meta.dev ? 'pretty' : 'json',
    resolveScope: () => {
      try {
        return scopeOf(useEvent())
      }
      catch {
        return undefined
      }
    },
  })
  writeLog({ level: 'info', category: 'system', event: 'system.start', message: 'Site server started', data: { node: process.version, pid: process.pid, level } })

  nitroApp.hooks.hook('request', (event) => {
    const incoming = getRequestHeader(event, 'x-request-id')
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID()
    const scope: RequestScope = { requestId, startedAt: performance.now(), actor: { kind: 'anonymous' }, db: { queries: 0, ms: 0, writes: 0 } }
    event.context.$log = scope
    setResponseHeader(event, 'X-Request-Id', requestId)
  })

  function summarise(event: H3Event, status: number, error?: unknown) {
    const scope = scopeOf(event) as (RequestScope & { done?: boolean }) | undefined
    if (!scope || scope.done) {
      return
    }
    scope.done = true
    const url = event.node.req.originalUrl || event.path || '/'
    const query = getQuery(event)
    const http: LogHttp = { method: event.method, path: url.split('?')[0], status }
    if (Object.keys(query).length) {
      http.query = Object.fromEntries(Object.entries(query).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 120) : v]))
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
    const referer = getRequestHeader(event, 'referer')
    if (referer) {
      try {
        http.referer = new URL(referer).host
      }
      catch {}
    }
    const durationMs = performance.now() - scope.startedAt
    const quiet = QUIET_PATH.test(http.path ?? '') || http.method === 'HEAD'
    writeLog({
      level: levelFor(status, quiet, durationMs > slowRequestMs),
      category: 'http',
      event: 'http.request',
      message: `${http.method} ${http.path} → ${status}`,
      outcome: outcomeFor(status),
      requestId: scope.requestId,
      http,
      durationMs,
      ...(error ? { error, stack: status >= 500 } : {}),
    })
  }

  nitroApp.hooks.hook('afterResponse', (event) => {
    summarise(event, event.node.res.statusCode)
  })

  nitroApp.hooks.hook('error', (error, context) => {
    const event = context.event as H3Event | undefined
    const e = error as Error & { statusCode?: number, unhandled?: boolean }
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
    }
    if (unexpected) {
      writeLog({ level: 'error', category: 'http', event: 'http.exception', message: `${event.method} ${event.path}: ${e.message || 'Internal error'}`, outcome: 'failure', requestId: scope?.requestId, error, stack: true })
    }
    if (!(context.tags as string[] | undefined)?.includes('response')) {
      summarise(event, status, error)
    }
  })

  nitroApp.hooks.hook('close', async () => {
    writeLog({ level: 'info', category: 'system', event: 'system.stop', message: 'Site server stopping' })
    await closeLog()
  })
})
