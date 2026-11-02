import { createError, defineEventHandler, getRouterParam } from 'h3'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { loadDocument, namesOf, summarise } from '../../../../../utils/website/content'

/**
 * POST /api/admin/website/documents/:id/withdraw — Withdraw from review:
 * back to draft so the author can keep editing. Nothing on the site changes.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const doc = await loadDocument(id)
  const moved = await prisma.siteDocument.updateMany({ where: { id, review: 'IN_REVIEW' }, data: { review: 'NONE', submittedById: null } })
  if (moved.count === 0) {
    throw createError({ statusCode: 409, message: 'This is not waiting for review.' })
  }
  await recordAudit(event, actor, { action: 'admin.website.document.withdraw', targetType: 'SiteDocument', targetId: id, subject: `${doc.title}${doc.kind === 'page' ? ` (${doc.key})` : ''}` })
  const fresh = await loadDocument(id)
  return { document: summarise(fresh, await namesOf([fresh.draftUpdatedById])) }
})
