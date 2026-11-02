import type { H3Event } from 'h3'
import type { AuthSession } from './auth'
import { getRequestIP } from 'h3'
import { auditCategory, writeLog } from './logger'
import prisma from './prisma'

/**
 * Audit trail for privileged actions. Call after every admin mutation:
 *
 *   const admin = await requireAdmin(event)
 *   // ...perform the change...
 *   await recordAudit(event, admin, {
 *     action: 'admin.user.update',
 *     targetType: 'User',
 *     targetId: user.id,
 *     metadata: { before, after },
 *   })
 *
 * Best-effort by design: an audit-write failure is logged but never
 * fails the request that already committed its change.
 */

export interface AuditEntry {
  /** Dot-namespaced verb, e.g. `admin.user.update`. */
  action: string
  /** Model name of the affected record: "User", "Project", ... */
  targetType: string
  targetId?: string
  /** Arbitrary JSON-serializable context (before/after snapshots, request details). */
  metadata?: unknown
  /**
   * The operator's typed justification, where the action asks for one
   * (Phase 9 Admin). Omit it entirely when none was required — an empty
   * string would render as a blank "Reason:" line on the audit screen.
   */
  reason?: string
  /**
   * Human-readable name of the record acted on, so the log stays legible
   * after the record is renamed or deleted. Falls back to the id.
   */
  subject?: string
}

/**
 * Actor of an audited action. Usually a full `AuthSession`, but
 * authentication events (failed logins, resets) are recorded before any
 * session exists — those pass just an identifier and the email attempted.
 */
export type AuditActor = (AuthSession | { id: string, email: string }) & { staffRole?: string }

export async function recordAudit(event: H3Event, actor: AuditActor, entry: AuditEntry): Promise<void> {
  // Every entry is also an `audit.<action>` line in the platform log, with
  // the target and the role held. The metadata stays in the audit table; the
  // log line carries only the names of its keys.
  const failed = /\.(?:fail|failed|denied|refused|locked)\b/.test(entry.action)
  const role = 'role' in actor ? actor.role : undefined
  writeLog({
    level: failed ? 'warn' : 'info',
    category: auditCategory(entry.action),
    event: `audit.${entry.action}`,
    message: `${entry.action} on ${entry.targetType}${entry.targetId ? ` ${entry.targetId}` : ''}`,
    outcome: failed ? 'failure' : 'success',
    actor: {
      id: actor.id,
      kind: role === 'ADMIN' ? 'staff' : role ? 'customer' : 'anonymous',
      ...(role ? { role } : {}),
      ...(actor.staffRole ? { staffRole: actor.staffRole } : {}),
    },
    data: {
      targetType: entry.targetType,
      targetId: entry.targetId,
      reasonGiven: Boolean(entry.reason?.trim()),
      ...(entry.metadata && typeof entry.metadata === 'object' ? { metadataKeys: Object.keys(entry.metadata as object) } : {}),
    },
  })
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        // The column is required and an account registered by phone has no
        // email, so writing null here threw and the entry was lost.
        actorEmail: actor.email ?? actor.id,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata === undefined && entry.subject === undefined
          ? null
          // `subject` rides inside metadata rather than taking a column of its
          // own: it is display sugar for the audit screen, and the column set
          // is already the thing every route writes to.
          : JSON.stringify({ ...(entry.subject === undefined ? {} : { subject: entry.subject }), ...(entry.metadata as object ?? {}) }),
        ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
        // The role held at the time of the action, not at read time (badge 30).
        roleAtTime: actor.staffRole ?? null,
        reason: entry.reason?.trim() || null,
      },
    })
  }
  catch (error) {
    writeLog({ level: 'error', category: 'system', event: 'audit.write-failed', message: `Could not record audit entry "${entry.action}"`, outcome: 'failure', error, stack: true })
  }
}
