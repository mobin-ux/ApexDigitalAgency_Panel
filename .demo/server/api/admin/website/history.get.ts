import { defineEventHandler } from 'h3'
import { isStaffRole, ROLES } from '../../../../shared/permissions'
import { paginated, paginationQuerySchema, toSkipTake } from '../../../utils/http'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { validateQuery } from '../../../utils/validate'
import { namesOf } from '../../../utils/website/content'

/**
 * GET /api/admin/website/history — the Pages screen's Publish history tab:
 * every content event (submitted, changes requested, published, restored,
 * withdrawn), newest first, read from the audit log so it is the same
 * record the Audit log screen shows. Saves are left out: they change no
 * page and would bury the decisions.
 */

const LABELS: Record<string, string> = {
  'admin.website.document.create': 'Created',
  'admin.website.document.submit': 'Submitted for review',
  'admin.website.document.withdraw': 'Withdrew from review',
  'admin.website.document.reject': 'Changes requested',
  'admin.website.document.approve': 'Published',
  'admin.website.document.publish': 'Published',
  'admin.website.document.restore-revision': 'Restored revision',
  'admin.website.document.import': 'Imported',
}

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const query = validateQuery(event, paginationQuerySchema)
  const where = { action: { in: Object.keys(LABELS) } }
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], ...toSkipTake(query), select: { id: true, action: true, actorId: true, roleAtTime: true, reason: true, metadata: true, createdAt: true, targetId: true } }),
    prisma.auditLog.count({ where }),
  ])
  const names = await namesOf(rows.map(r => r.actorId))
  // The subject is stored inside the metadata by recordAudit; read it back for the row.
  const subjectOf = (metadata: string | null) => {
    try {
      const parsed = metadata ? JSON.parse(metadata) as { subject?: string } : null
      return parsed?.subject ?? ''
    }
    catch {
      return ''
    }
  }
  return paginated(rows.map(r => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    action: LABELS[r.action] ?? r.action,
    kind: r.action.split('.').pop(),
    actor: names.get(r.actorId) ?? 'Staff',
    role: isStaffRole(r.roleAtTime) ? ROLES[r.roleAtTime].label : null,
    reason: r.reason,
    subject: subjectOf(r.metadata),
    documentId: r.targetId,
  })), total, query)
})
