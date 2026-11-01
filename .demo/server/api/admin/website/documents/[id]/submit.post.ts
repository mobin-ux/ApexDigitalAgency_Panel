import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { notifyRoles } from '../../../../../utils/notify'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { checkedContent, editorPath, isDirty, loadDocument, namesOf, summarise, templateOf } from '../../../../../utils/website/content'

/**
 * POST /api/admin/website/documents/:id/submit — Submit for review. An
 * Owner or Admin approves it before it goes live; until then the draft is
 * locked for its author. The draft must be complete (it is checked against
 * its template here) and must differ from what is live.
 */

const bodySchema = z.object({ note: z.string().trim().max(500).optional() }).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const { note } = await validateBody(event, bodySchema)
  const doc = await loadDocument(id)
  if (doc.review === 'IN_REVIEW') {
    throw createError({ statusCode: 409, message: 'This is already waiting for review.' })
  }
  if (doc.status === 'PUBLISHED' && !isDirty(doc)) {
    throw createError({ statusCode: 409, message: 'The draft matches the live page. There is nothing to review.' })
  }
  checkedContent(templateOf(doc), JSON.parse(doc.draft))

  const moved = await prisma.siteDocument.updateMany({ where: { id, review: 'NONE' }, data: { review: 'IN_REVIEW', submittedById: actor.id } })
  if (moved.count === 0) {
    throw createError({ statusCode: 409, message: 'This is already waiting for review.' })
  }
  const subject = `${doc.title}${doc.kind === 'page' ? ` (${doc.key})` : ''}`
  await recordAudit(event, actor, { action: 'admin.website.document.submit', targetType: 'SiteDocument', targetId: id, subject, ...(note ? { reason: note } : {}) })
  const names = await namesOf([actor.id])
  await notifyRoles('website.publish', {
    title: `Waiting for review: ${doc.title}`.slice(0, 200),
    message: `${names.get(actor.id) ?? 'A colleague'} sent this for review.${note ? ` Note: ${note}` : ''}`,
    link: editorPath(doc),
    excludeUserId: actor.id,
  })

  const fresh = await loadDocument(id)
  return { document: summarise(fresh, await namesOf([fresh.draftUpdatedById, fresh.submittedById])) }
})
