import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { checkBuiltPath, isBuiltTemplate } from '../../../../../../shared/cms'
import { can, rolesWith } from '../../../../../../shared/permissions'
import { recordAudit } from '../../../../../utils/audit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'
import { assertDraftOpen, loadDocument, namesOf, revalidateSite, summarise, templateOf } from '../../../../../utils/website/content'

/**
 * PATCH /api/admin/website/documents/:id/path — move a page, article or
 * case study built in the console to a new address (the editor's SEO tab,
 * ADR-026). The site's own pages keep the address their code gives them.
 *
 * A document that was ever live leaves a 301 from its old address, so
 * links and search results keep working; redirects that pointed at the old
 * address are moved to the new one rather than chained, and a redirect
 * from the new address is dropped because a page lives there now. Adding
 * a redirect is a structural change, so moving a live page needs
 * `website.seo` as well as `website.edit`; a draft nobody has seen moves
 * freely.
 */

const bodySchema = z.object({ path: z.string().trim().min(1).max(200) }).strict()

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
  if (!isBuiltTemplate(template)) {
    throw createError({ statusCode: 400, message: 'This page\'s address is set by the site\'s code and cannot change here.' })
  }

  const where = checkBuiltPath(template, body.path)
  if (!where.ok) {
    throw createError({ statusCode: 400, message: where.message, data: { fieldErrors: { path: [where.message] } } })
  }
  const from = doc.key
  const to = where.path
  if (from === to) {
    return { document: summarise(doc, await namesOf([doc.draftUpdatedById, doc.submittedById])), redirect: null }
  }
  const taken = await prisma.siteDocument.findFirst({ where: { kind: 'page', key: to }, select: { title: true, archivedAt: true } })
  if (taken) {
    const message = `${to} is already ${taken.archivedAt ? 'used by an archived document' : `"${taken.title}"`}.`
    throw createError({ statusCode: 409, message, data: { fieldErrors: { path: [message] } } })
  }

  const wasLive = (await prisma.siteRevision.count({ where: { documentId: id, publishedAt: { not: null } } })) > 0
  if (wasLive && !can(actor.staffRole, 'website.seo')) {
    const roles = rolesWith('website.seo').map(r => r.label)
    throw createError({ statusCode: 403, message: `This page has been live, so moving it adds a redirect. That needs ${roles.join(' or ')}.`, data: { permission: 'website.seo' } })
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteDocument.update({ where: { id }, data: { key: to } })
    if (!wasLive) {
      return
    }
    await tx.siteRedirect.deleteMany({ where: { fromPath: to } })
    await tx.siteRedirect.updateMany({ where: { toPath: from }, data: { toPath: to } })
    await tx.siteRedirect.upsert({
      where: { fromPath: from },
      create: { fromPath: from, toPath: to, statusCode: 301, enabled: true, note: `Moved "${doc.title}"`, createdById: actor.id },
      update: { toPath: to, statusCode: 301, enabled: true },
    })
  })

  await recordAudit(event, actor, {
    action: 'admin.website.document.key',
    targetType: 'SiteDocument',
    targetId: id,
    subject: `${doc.title} (${to})`,
    metadata: { from, to, redirect: wasLive },
  })
  const revalidated = wasLive ? await revalidateSite(event) : false

  const fresh = await loadDocument(id)
  return { document: summarise(fresh, await namesOf([fresh.draftUpdatedById, fresh.submittedById])), redirect: wasLive ? { from, to } : null, revalidated }
})
