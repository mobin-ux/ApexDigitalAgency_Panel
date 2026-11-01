import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { editorPath, loadDocument, namesOf, parseContent, summarise } from '../../../../utils/website/content'

/**
 * GET /api/admin/website/documents/:id — everything the editor shows:
 * the draft, the live revision's content (so the preview can say whether
 * it matches), the revision history, and the latest "Request changes" note
 * when it came after the latest submission (the design's red banner).
 *
 * The note is read from the audit log, which already holds it with the
 * reviewer and the time, rather than copied into a column of its own.
 */
export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const doc = await loadDocument(id)

  const [revisions, decisions] = await Promise.all([
    prisma.siteRevision.findMany({ where: { documentId: id }, orderBy: { number: 'desc' }, select: { id: true, number: true, note: true, authorId: true, createdAt: true, publishedAt: true } }),
    prisma.auditLog.findMany({
      where: { targetType: 'SiteDocument', targetId: id, action: { in: ['admin.website.document.submit', 'admin.website.document.reject'] } },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { action: true, actorId: true, reason: true, createdAt: true },
    }),
  ])
  const names = await namesOf([doc.draftUpdatedById, doc.submittedById, doc.publishedById, doc.createdById, ...revisions.map(r => r.authorId), ...decisions.map(d => d.actorId)])
  const latest = decisions[0]
  const changesRequested = doc.review === 'NONE' && latest?.action === 'admin.website.document.reject'
    ? { note: latest.reason ?? '', by: names.get(latest.actorId) ?? 'A reviewer', at: latest.createdAt.toISOString() }
    : null

  return {
    document: summarise(doc, names),
    key: doc.key,
    kind: doc.kind,
    draft: parseContent(doc.draft),
    draftVersion: doc.draftVersion,
    live: doc.publishedRevision ? parseContent(doc.publishedRevision.content) : null,
    liveRevision: doc.publishedRevision?.number ?? null,
    createdAt: doc.createdAt.toISOString(),
    createdBy: names.get(doc.createdById) ?? null,
    publishedBy: doc.publishedById ? names.get(doc.publishedById) ?? null : null,
    changesRequested,
    editor: editorPath(doc),
    revisions: revisions.map(r => ({
      id: r.id,
      number: r.number,
      note: r.note,
      by: names.get(r.authorId) ?? 'Staff',
      at: (r.publishedAt ?? r.createdAt).toISOString(),
      published: r.publishedAt !== null,
      live: r.number === doc.publishedRevision?.number,
    })),
  }
})
