import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { assertDraftOpen, checkedContent, loadDocument, namesOf, summarise, syncMediaRefs, templateOf } from '../../../../../utils/website/content'

/**
 * PUT /api/admin/website/documents/:id/draft — Save draft. The live page
 * does not change. `version` is the draft version the editor loaded: a save
 * over someone else's newer save is refused (409) with the current version,
 * so two people editing one page cannot silently overwrite each other.
 *
 * The content is checked against the document's template; field errors
 * come back by dotted path (`sections.2.fields.title`, `hero.lead`).
 */

const bodySchema = z.object({
  content: z.unknown(),
  version: z.number().int().min(1),
  title: z.string().trim().min(2).max(120).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Document id is required' })
  }
  const body = await validateBody(event, bodySchema)
  const doc = await loadDocument(id)
  assertDraftOpen(doc, actor.staffRole)
  const template = templateOf(doc)
  const draft = checkedContent(template, body.content)

  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.siteDocument.updateMany({
      where: { id, draftVersion: body.version },
      data: {
        draft,
        draftVersion: { increment: 1 },
        draftUpdatedAt: new Date(),
        draftUpdatedById: actor.id,
        ...(body.title ? { title: body.title } : {}),
      },
    })
    if (updated.count === 0) {
      return null
    }
    await syncMediaRefs(tx, id, 'draft', template, draft)
    return tx.siteDocument.findUniqueOrThrow({ where: { id }, include: { publishedRevision: { select: { content: true, number: true } } } })
  })
  if (!saved) {
    const current = await prisma.siteDocument.findUnique({ where: { id }, select: { draftVersion: true, draftUpdatedById: true } })
    const by = current?.draftUpdatedById ? (await namesOf([current.draftUpdatedById])).get(current.draftUpdatedById) : null
    throw createError({ statusCode: 409, message: `${by ?? 'Someone'} saved this while you were editing. Reload to see their version.`, data: { version: current?.draftVersion ?? null } })
  }

  await recordAudit(event, actor, {
    action: 'admin.website.document.save',
    targetType: 'SiteDocument',
    targetId: id,
    subject: `${saved.title}${saved.kind === 'page' ? ` (${saved.key})` : ''}`,
    metadata: { version: saved.draftVersion, ...(body.title && body.title !== doc.title ? { before: { title: doc.title }, after: { title: body.title } } : {}) },
  })

  return { document: summarise(saved, await namesOf([saved.draftUpdatedById, saved.submittedById])), draftVersion: saved.draftVersion }
})
