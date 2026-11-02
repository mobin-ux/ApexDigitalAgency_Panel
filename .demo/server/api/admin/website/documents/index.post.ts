import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { checkBuiltPath } from '../../../../../shared/cms'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'
import { DOCUMENT_INCLUDE, editorPath, namesOf, starterContent, summarise } from '../../../../utils/website/content'

/**
 * POST /api/admin/website/documents — New page, New article or New case
 * study (ADR-026). The document starts as a draft built from the design's
 * starting sections; nothing reaches the site until it is published.
 *
 * The address is checked against the site's own routes, and against every
 * document already stored at it (including the coded pages once imported).
 */

const bodySchema = z.object({
  template: z.enum(['built-page', 'built-article', 'built-case-study']),
  title: z.string().trim().min(2, 'Give it a name').max(120),
  path: z.string().trim().min(1).max(200),
}).strict()

export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.edit')
  const body = await validateBody(event, bodySchema)

  const where = checkBuiltPath(body.template, body.path)
  if (!where.ok) {
    throw createError({ statusCode: 400, message: where.message, data: { fieldErrors: { path: [where.message] } } })
  }
  const taken = await prisma.siteDocument.findFirst({ where: { kind: 'page', key: where.path }, select: { title: true, archivedAt: true } })
  if (taken) {
    const message = `${where.path} is already ${taken.archivedAt ? 'used by an archived document' : `"${taken.title}"`}.`
    throw createError({ statusCode: 409, message, data: { fieldErrors: { path: [message] } } })
  }

  const now = new Date()
  const doc = await prisma.siteDocument.create({
    data: {
      kind: 'page',
      template: body.template,
      key: where.path,
      title: body.title,
      draft: JSON.stringify(starterContent(body.template, body.title)),
      draftUpdatedAt: now,
      draftUpdatedById: actor.id,
      createdById: actor.id,
    },
    include: DOCUMENT_INCLUDE,
  })

  await recordAudit(event, actor, {
    action: 'admin.website.document.create',
    targetType: 'SiteDocument',
    targetId: doc.id,
    subject: `${doc.title} (${doc.key})`,
    metadata: { template: doc.template, path: doc.key },
  })

  return { document: summarise(doc, await namesOf([actor.id])), editor: editorPath(doc) }
})
