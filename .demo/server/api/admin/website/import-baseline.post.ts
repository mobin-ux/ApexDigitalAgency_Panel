import { createError } from 'h3'
import { isTemplateKey, TEMPLATES, validateContent } from '../../../../shared/cms'
import { recordAudit } from '../../../utils/audit'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { websiteRuntime } from '../../../utils/website/publish'

interface BaselineDocument {
  kind: 'page' | 'global'
  template: string
  key: string
  title: string
  content: unknown
}

/**
 * Pull the site's code baseline and create one document per entry that
 * does not exist yet, published as revision 1 "Imported from site code".
 * Idempotent: a document that already exists is left alone, so running it
 * again after a new service page or article lands adds only the new ones.
 * Publishing the import changes nothing on the site, because the content
 * is exactly what the site already renders.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireStaffPermission(event, 'website.settings')
  rateLimit(event, { ...RateLimits.mutation, identity: actor.id })
  const { siteUrl } = websiteRuntime()
  if (!siteUrl) {
    throw createError({ statusCode: 503, message: 'No site URL is configured (NUXT_WEBSITE_SITE_URL), so there is nothing to import from.' })
  }

  let documents: BaselineDocument[]
  try {
    const res = await fetch(`${siteUrl}/api/cms/baseline`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      throw createError({ statusCode: 502, message: `The site answered ${res.status} for its baseline.` })
    }
    documents = ((await res.json()) as { documents: BaselineDocument[] }).documents
  }
  catch (error) {
    if ((error as { statusCode?: number }).statusCode) {
      throw error
    }
    throw createError({ statusCode: 502, message: 'The site could not be reached for its baseline.' })
  }

  const existing = new Set((await prisma.siteDocument.findMany({ select: { kind: true, key: true } })).map(d => `${d.kind}:${d.key}`))
  const created: string[] = []
  const skipped: string[] = []
  const invalid: string[] = []
  const now = new Date()

  for (const doc of documents) {
    if (!isTemplateKey(doc.template) || TEMPLATES[doc.template].kind !== doc.kind) {
      invalid.push(`${doc.template}:${doc.key}`)
      continue
    }
    if (existing.has(`${doc.kind}:${doc.key}`)) {
      skipped.push(`${doc.kind}:${doc.key}`)
      continue
    }
    const check = validateContent(doc.template, doc.content)
    if (!check.ok) {
      invalid.push(`${doc.template}:${doc.key}`)
      continue
    }
    const content = JSON.stringify(check.content)
    await prisma.$transaction(async (tx) => {
      const row = await tx.siteDocument.create({
        data: {
          kind: doc.kind,
          template: doc.template,
          key: doc.key,
          title: doc.title,
          status: 'PUBLISHED',
          draft: content,
          draftUpdatedById: actor.id,
          createdById: actor.id,
          publishedAt: now,
          publishedById: actor.id,
        },
      })
      const revision = await tx.siteRevision.create({
        data: { documentId: row.id, number: 1, content, note: 'Imported from site code', authorId: actor.id, publishedAt: now },
      })
      await tx.siteDocument.update({ where: { id: row.id }, data: { publishedRevisionId: revision.id } })
    })
    created.push(`${doc.kind}:${doc.key}`)
  }

  await recordAudit(event, actor, {
    action: 'admin.website.import',
    targetType: 'SiteDocument',
    subject: 'Site baseline',
    metadata: { created: created.length, skipped: skipped.length, invalid: invalid.length },
  })
  return { created, skipped, invalid }
})
