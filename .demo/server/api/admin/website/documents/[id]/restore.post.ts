import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { assertDraftOpen, loadDocument, namesOf, summarise, syncMediaRefs, templateOf } from '../../../../../utils/website/content'

/**
 * POST /api/admin/website/documents/:id/restore — Restore a revision as the
 * draft. The live page stays as it is until someone publishes.
 */

const bodySchema = z.object({ revision: z.number().int().min(1) }).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const { revision } = await validateBody(event, bodySchema)
  const doc = await loadDocument(id)
  assertDraftOpen(doc, actor.staffRole)
  const source = await prisma.siteRevision.findUnique({ where: { documentId_number: { documentId: id, number: revision } }, select: { content: true } })
  if (!source) {
    throw createError({ statusCode: 404, message: `Revision ${revision} not found` })
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteDocument.update({
      where: { id },
      data: { draft: source.content, draftVersion: { increment: 1 }, draftUpdatedAt: new Date(), draftUpdatedById: actor.id },
    })
    await syncMediaRefs(tx, id, 'draft', templateOf(doc), source.content)
  })
  await recordAudit(event, actor, { action: 'admin.website.document.restore-revision', targetType: 'SiteDocument', targetId: id, subject: `${doc.title}${doc.kind === 'page' ? ` (${doc.key})` : ''}`, metadata: { revision } })

  const fresh = await loadDocument(id)
  return { document: summarise(fresh, await namesOf([fresh.draftUpdatedById])), draftVersion: fresh.draftVersion }
})
