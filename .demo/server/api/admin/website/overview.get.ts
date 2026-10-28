import { displayStatus } from '../../../../shared/cms'
import { can } from '../../../../shared/permissions'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { seoAudit } from '../../../utils/website/seo-audit'

/**
 * The Website overview (ADR-021): counts by display status, what is waiting
 * to go live, what failed, and the most recent website activity. Every
 * figure is a count of rows a later screen lists; nothing here is derived
 * from anything but the tables.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.view')

  // The audit is for the roles that may act on it; a count a reader cannot open would be a figure with no screen behind it.
  const seo = can(actor.staffRole, 'website.seo') ? await seoAudit() : null

  const [documents, media, redirects, recent] = await Promise.all([
    prisma.siteDocument.findMany({
      select: {
        id: true,
        kind: true,
        template: true,
        key: true,
        title: true,
        status: true,
        review: true,
        publishedRevisionId: true,
        scheduledRevisionId: true,
        scheduledFor: true,
        lastPublishError: true,
        revalidatePending: true,
        draftUpdatedAt: true,
        publishedRevision: { select: { content: true } },
        draft: true,
      },
      orderBy: { draftUpdatedAt: 'desc' },
    }),
    prisma.siteMedia.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _sum: { bytes: true } }),
    prisma.siteRedirect.groupBy({ by: ['enabled'], _count: { _all: true } }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: 'admin.website.' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, actorEmail: true, targetId: true, metadata: true, createdAt: true },
    }),
  ])

  const counts: Record<string, number> = { draft: 0, in_review: 0, approved: 0, scheduled: 0, published: 0, published_changes: 0, archived: 0 }
  const scheduled: { id: string, title: string, key: string, scheduledFor: Date | null }[] = []
  const failed: { id: string, title: string, key: string, error: string, scheduledFor: Date | null }[] = []
  let revalidatePending = 0

  for (const doc of documents) {
    const state = displayStatus({
      status: doc.status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
      review: doc.review as 'NONE' | 'IN_REVIEW' | 'APPROVED',
      publishedRevisionId: doc.publishedRevisionId,
      scheduledRevisionId: doc.scheduledRevisionId,
      scheduledFor: doc.scheduledFor,
      draftChanged: doc.publishedRevision ? doc.publishedRevision.content !== doc.draft : true,
    })
    counts[state] = (counts[state] ?? 0) + 1
    if (doc.scheduledRevisionId) {
      scheduled.push({ id: doc.id, title: doc.title, key: doc.key, scheduledFor: doc.scheduledFor })
    }
    if (doc.lastPublishError) {
      failed.push({ id: doc.id, title: doc.title, key: doc.key, error: doc.lastPublishError, scheduledFor: doc.scheduledFor })
    }
    if (doc.revalidatePending) {
      revalidatePending += 1
    }
  }
  scheduled.sort((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0))

  const redirectCounts = { enabled: 0, disabled: 0 }
  for (const row of redirects) {
    redirectCounts[row.enabled ? 'enabled' : 'disabled'] = row._count._all
  }

  return {
    documents: {
      total: documents.length,
      byKind: {
        page: documents.filter(d => d.kind === 'page').length,
        global: documents.filter(d => d.kind === 'global').length,
        panel: documents.filter(d => d.kind === 'panel').length,
      },
      byStatus: counts,
    },
    scheduled,
    failed,
    revalidatePending,
    media: { count: media._count._all, bytes: media._sum.bytes ?? 0 },
    redirects: redirectCounts,
    seo: seo ? { issues: seo.issues.length, errors: seo.issues.filter(i => i.severity === 'error').length, warnings: seo.issues.filter(i => i.severity === 'warning').length } : null,
    recent,
  }
})
