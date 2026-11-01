import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { notify } from '../../../../../utils/notify'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { editorPath, loadDocument, namesOf, summarise } from '../../../../../utils/website/content'

/**
 * POST /api/admin/website/documents/:id/request-changes — send a submission
 * back to draft with a note, which the author sees pinned at the top of the
 * editor. The note is required: "changes" with no word of what to change is
 * a dead end for the author.
 */

const bodySchema = z.object({ note: z.string().trim().min(3, 'Say what needs changing').max(500) }).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.publish')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const { note } = await validateBody(event, bodySchema)
  const doc = await loadDocument(id)
  const moved = await prisma.siteDocument.updateMany({ where: { id, review: 'IN_REVIEW' }, data: { review: 'NONE', submittedById: null } })
  if (moved.count === 0) {
    throw createError({ statusCode: 409, message: 'This is not waiting for review.' })
  }
  await recordAudit(event, actor, { action: 'admin.website.document.reject', targetType: 'SiteDocument', targetId: id, subject: `${doc.title}${doc.kind === 'page' ? ` (${doc.key})` : ''}`, reason: note })
  if (doc.submittedById) {
    await notify({
      userIds: [doc.submittedById],
      title: `Changes requested: ${doc.title}`.slice(0, 200),
      message: note,
      type: 'WARNING',
      link: editorPath(doc),
      excludeUserId: actor.id,
    })
  }
  const fresh = await loadDocument(id)
  return { document: summarise(fresh, await namesOf([fresh.draftUpdatedById])) }
})
