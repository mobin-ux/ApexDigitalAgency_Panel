import { defineEventHandler } from 'h3'
import { collectionOf, isBuiltTemplate, isDocumentTemplate, seoOf } from '../../../../shared/cms'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { DOCUMENT_INCLUDE, editorPath, isDirty, parseContent } from '../../../utils/website/content'

/**
 * GET /api/admin/website/seo — SEO & redirects (`v_42seo`): one row per
 * page, article and case study with its search title and description
 * lengths, whether it is indexed and the first thing to fix; and what the
 * sitemap lists and leaves out.
 *
 * The figures are the live version's when the document is published,
 * else the draft's: what a search engine sees, or would see. An empty
 * search title falls back to the page's own title on the site, so it is
 * counted at that length rather than flagged.
 */

const TITLE_MAX = 60
const DESCRIPTION_MAX = 160

export default defineEventHandler(async (event) => {
  await requireStaffPermission(event, 'website.view')
  const docs = await prisma.siteDocument.findMany({ where: { kind: 'page', archivedAt: null }, include: DOCUMENT_INCLUDE, orderBy: { key: 'asc' } })

  const rows = docs.filter(d => isDocumentTemplate(d.template)).map((doc) => {
    const template = doc.template as Parameters<typeof collectionOf>[0]
    const published = doc.status === 'PUBLISHED' && doc.publishedRevision !== null
    const content = parseContent(published ? doc.publishedRevision!.content : doc.draft) as { meta?: { summary?: string }, sections?: { type: string, hidden?: boolean, fields?: { body?: string } }[] } | null
    const seo = seoOf(content)
    const title = seo.title.trim() || doc.title
    // A built document with no description of its own is served its summary,
    // else its hero's intro (`CmsBuiltPage`), so count what the site sends.
    const hero = content?.sections?.find(s => !s.hidden)
    const fallback = isBuiltTemplate(template) ? (content?.meta?.summary?.trim() || (hero?.type === 'hero' ? hero.fields?.body?.trim().slice(0, 200) : '') || '') : ''
    const description = seo.description.trim() || fallback
    const indexed = !seo.robots.startsWith('noindex')
    const issues: string[] = []
    if (!published) {
      issues.push(doc.review === 'IN_REVIEW' ? 'In review' : 'Not published')
    }
    if (title.length > TITLE_MAX) {
      issues.push('Title too long')
    }
    if (!description) {
      issues.push('Description missing')
    }
    else if (description.length > DESCRIPTION_MAX) {
      issues.push('Description too long')
    }
    const problem = issues.find(i => i !== 'Not published' && i !== 'In review')
    return {
      id: doc.id,
      title: doc.title,
      path: doc.key,
      collection: collectionOf(template),
      built: isBuiltTemplate(template),
      editor: editorPath(doc),
      published,
      dirty: isDirty(doc),
      titleLength: title.length,
      descriptionLength: description.length,
      indexed,
      check: problem ?? issues[0] ?? 'No issues',
      tone: problem ? 'warning' as const : issues.length ? 'neutral' as const : 'success' as const,
    }
  })
  // Things to fix first, then the rest in address order.
  rows.sort((a, b) => Number(a.tone !== 'warning') - Number(b.tone !== 'warning') || a.path.localeCompare(b.path))

  const listed = rows.filter(r => r.published && r.indexed)
  const excluded = rows.filter(r => !r.published || !r.indexed).map(r => ({ path: r.path, why: !r.published ? r.check === 'In review' ? 'In review' : 'Draft' : 'Set to noindex' }))

  return { rows, limits: { title: TITLE_MAX, description: DESCRIPTION_MAX }, sitemap: { listed: listed.length, excluded } }
})
