import { defineEventHandler } from 'h3'
import { isBuiltTemplate, isDocumentTemplate, validateDocumentContent } from '../../../../shared/cms'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { fetchSiteBaseline, kindOf, revalidateSite } from '../../../utils/website/content'

/**
 * POST /api/admin/website/import — bring the site's existing pages into the
 * Website screens (ADR-026). The site serves its code baseline; every page
 * and piece of chrome that has no document yet becomes one, published as
 * revision 1 with exactly the words the site already shows, so importing
 * changes nothing a visitor sees. Documents that exist are left alone, so
 * running it again only adds what is new in the code (a new service page).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.publish')
  const baseline = await fetchSiteBaseline(event)

  const existing = new Set((await prisma.siteDocument.findMany({ select: { kind: true, key: true } })).map(d => `${d.kind}:${d.key}`))
  const created: string[] = []
  const skipped: { key: string, reason: string }[] = []
  const now = new Date()

  for (const item of baseline) {
    if (!isDocumentTemplate(item.template) || isBuiltTemplate(item.template)) {
      skipped.push({ key: item.key, reason: `unknown template "${item.template}"` })
      continue
    }
    const kind = kindOf(item.template)
    if (existing.has(`${kind}:${item.key}`)) {
      continue
    }
    const checked = validateDocumentContent(item.template, item.content)
    if (!checked.ok) {
      skipped.push({ key: item.key, reason: checked.issues.slice(0, 2).map(i => `${i.path}: ${i.message}`).join('; ') })
      continue
    }
    const content = JSON.stringify(checked.content)
    await prisma.$transaction(async (tx) => {
      const doc = await tx.siteDocument.create({
        data: { kind, template: item.template, key: item.key, title: item.title.slice(0, 120), draft: content, draftUpdatedAt: now, draftUpdatedById: actor.id, createdById: actor.id, status: 'PUBLISHED', publishedAt: now, publishedById: actor.id },
      })
      const revision = await tx.siteRevision.create({ data: { documentId: doc.id, number: 1, content, note: 'Imported from the site', authorId: actor.id, publishedAt: now } })
      await tx.siteDocument.update({ where: { id: doc.id }, data: { publishedRevisionId: revision.id } })
    })
    existing.add(`${kind}:${item.key}`)
    created.push(item.key)
  }

  if (created.length) {
    await recordAudit(event, actor, {
      action: 'admin.website.document.import',
      targetType: 'SiteDocument',
      subject: `${created.length} page${created.length === 1 ? '' : 's'} from the site`,
      metadata: { created, skipped },
    })
  }
  const revalidated = created.length ? await revalidateSite(event) : false
  return { created: created.length, skipped, revalidated }
})
