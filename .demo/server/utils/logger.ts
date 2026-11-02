import type { H3Event } from 'h3'
import type { LogActor, LogCategory, LogLevel, LogOutcome } from '../../shared/log'
import type { AuthSession } from './auth'
import { log, writeLog } from '../../shared/log'
import { redact } from '../../shared/redact'

/**
 * The panel's side of the platform log (`shared/log.ts`). The record shape,
 * the redaction rules, the sinks and the request scope live there; this
 * file adds what only the panel knows: who a session is, how the audit
 * trail maps onto categories, and the older `createLogger(scope)` API that
 * the payment rails and the mail outbox were written against.
 *
 * Use `log('<category>').info('<event>', '<message>', { outcome, data })`
 * for new code. The request id and the actor are filled in from the request
 * being served (plugins/00.logging.ts), so a call deep in a utility still
 * says which request and which person it belonged to.
 */

export { log, logTimed, writeLog } from '../../shared/log'
export { redact }

export type { LogLevel }

/** The actor a session describes, as the log records it (no email, no name). */
export function actorOf(session: Pick<AuthSession, 'id' | 'role'> & { kind?: string, staffRole?: string | null } | null | undefined): LogActor {
  if (!session) {
    return { kind: 'anonymous' }
  }
  const staff = session.kind === 'staff'
  return {
    id: session.id,
    kind: staff ? 'staff' : 'customer',
    role: session.role,
    ...(session.staffRole ? { staffRole: session.staffRole } : {}),
  }
}

/** Sets the actor for the rest of the request, once a route has identified who is asking. */
export function setLogActor(event: H3Event, actor: LogActor): void {
  const scope = event.context.$log as { actor?: LogActor } | undefined
  if (scope) {
    scope.actor = actor
  }
}

const SCOPE_CATEGORY: [RegExp, LogCategory][] = [
  [/^payments?\b/, 'payment'],
  [/^webhook/, 'payment'],
  [/^mail\b/, 'mail'],
  [/^audit\b/, 'admin'],
  [/^auth\b/, 'auth'],
  [/^(?:crypto|ratelimit|security)\b/, 'security'],
  [/^(?:task|cron)\b/, 'task'],
]

function categoryOf(scope: string): LogCategory {
  return SCOPE_CATEGORY.find(([re]) => re.test(scope))?.[1] ?? 'system'
}

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
  child: (childScope: string) => Logger
}

/**
 * `const log = createLogger('payments:stripe')`. Each line's event is the
 * scope with dots (`payments.stripe`), its category is derived from the
 * scope, and an `error` key in the context is recorded as the error.
 */
export function createLogger(scope: string): Logger {
  const category = categoryOf(scope)
  const event = scope.replace(/:/g, '.')
  const at = (level: LogLevel) => (message: string, context?: Record<string, unknown>) => {
    const { error, outcome, ...data } = context ?? {}
    writeLog({
      level,
      category,
      event,
      message,
      ...(typeof outcome === 'string' ? { outcome: outcome as LogOutcome } : level === 'error' ? { outcome: 'failure' as const } : {}),
      ...(error === undefined ? {} : { error: typeof error === 'string' ? new Error(error) : error, stack: level === 'error' && typeof error !== 'string' }),
      data,
    })
  }
  return {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: (childScope: string) => createLogger(`${scope}:${childScope}`),
  }
}

/** The category an audited action belongs to, by its prefix. */
export function auditCategory(action: string): LogCategory {
  if (action.startsWith('auth.') || action.startsWith('admin.auth.') || action.includes('.two-factor')) {
    return 'auth'
  }
  if (action.startsWith('admin.website.')) {
    return 'content'
  }
  if (action.startsWith('admin.') || action.startsWith('system.')) {
    return 'admin'
  }
  return 'customer'
}

/**
 * A customer's own action, beside the request line: what they did, to which
 * record, and how it went. `data` carries ids, amounts and states, never
 * the words they typed.
 */
export function logActivity(eventName: string, message: string, data?: Record<string, unknown>, outcome: LogOutcome = 'success'): void {
  log('customer').info(eventName, message, { outcome, data })
}
