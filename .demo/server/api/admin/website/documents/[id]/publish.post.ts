import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { notify } from '../../../../../utils/notify'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { checkedContent, editorPath, isDirty, loadDocument, namesOf, publishDraft, revalidateSite, summarise, templateOf } from '../../../../../utils/website/content'

/**
 * POST /api/admin/website/documents/:id/publish — Publish, Publish changes,
 * or Approve and publish when the draft is in review. The draft becomes a
 * new revision and the live version; the one it replaces stays in
 * Revisions. `version` is the draft the publisher looked at: if it changed
 * since, the publish is refused rather than putting unseen words live.
 */

const bodySchema = z.object({
  note: z.string().trim().max(500).optional(),
  version: z.number().int().min(1),
}).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.publish')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const { note, version } = await validateBody(event, bodySchema)
  const doc = await loadDocument(id)
  if (doc.draftVersion !== version) {
    throw createError({ statusCode: 409, message: 'The draft changed since you opened it. Reload and check it before publishing.', data: { version: doc.draftVersion } })
  }
  if (doc.status === 'PUBLISHED' && !isDirty(doc)) {
    throw createError({ statusCode: 409, message: 'The draft matches the live page. There is nothing to publish.' })
  }
  checkedContent(templateOf(doc), JSON.parse(doc.draft))

  const wasReview = doc.review === 'IN_REVIEW'
  const revision = await prisma.$transaction(tx => publishDraft(tx, doc, actor.id, note ?? null))
  const revalidated = await revalidateSite(event)
  if (!revalidated) {
    await prisma.siteDocument.update({ where: { id }, data: { revalidatePending: true } })
  }

  await recordAudit(event, actor, {
    action: wasReview ? 'admin.website.document.approve' : 'admin.website.document.publish',
    targetType: 'SiteDocument',
    targetId: id,
    subject: `${doc.title}${doc.kind === 'page' ? ` (${doc.key})` : ''}`,
    metadata: { revision, revalidated },
    ...(note ? { reason: note } : {}),
  })
  if (doc.submittedById && doc.submittedById !== actor.id) {
    await notify({
      userIds: [doc.submittedById],
      title: `Published: ${doc.title}`.slice(0, 200),
      message: note ? `Your changes are live. Note: ${note}` : 'Your changes are live on the website.',
      type: 'SUCCESS',
      link: editorPath(doc),
    })
  }

  const fresh = await loadDocument(id)
  return { document: summarise(fresh, await namesOf([fresh.draftUpdatedById])), revision, revalidated }
})
