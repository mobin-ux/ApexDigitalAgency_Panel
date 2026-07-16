import type { H3Event } from 'h3'
import type { AuthSession } from './auth'
import { getRequestIP } from 'h3'
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
}

export async function recordAudit(event: H3Event, actor: AuthSession, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata === undefined ? null : JSON.stringify(entry.metadata),
        ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
      },
    })
  }
  catch (error) {
    console.error(`[audit] failed to record "${entry.action}"`, error)
  }
}
