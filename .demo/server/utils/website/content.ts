import type { SiteDocument, SiteRevision } from '@prisma/client'
import type { H3Event } from 'h3'
import type { Collection, DocumentStatus, DocumentTemplate, ReviewState } from '../../../shared/cms'
import type { StaffRole } from '../../../shared/permissions'
import type { Db } from '../mail/outbox'
import { createError } from 'h3'
import { collectionOf, documentTypeLabel, isBuiltTemplate, isDocumentTemplate, sectionMediaIds, statusChip, TEMPLATES, validateDocumentContent } from '../../../shared/cms'
import { can } from '../../../shared/permissions'
import prisma from '../prisma'

/**
 * The Website screens' documents (ADR-026): pages, articles, case studies
 * and the site chrome, stored as `SiteDocument` rows with their
 * `SiteRevision` history.
 *
 * - `draft` is the working copy; saving it never changes the live site.
 * - Publishing writes a revision and points `publishedRevisionId` at it.
 * - `review` is IN_REVIEW between "Submit for review" and an Owner or
 *   Admin's decision; the draft is locked then for anyone who cannot
 *   publish, so the reviewer reads what was submitted.
 * - A published document whose draft differs from the live revision is
 *   "Published · draft changes" (`dirty`).
 *
 * Every write is the caller's to audit; these helpers only move state.
 */

export type DocumentRow = SiteDocument & { publishedRevision: Pick<SiteRevision, 'content' | 'number'> | null }

export const DOCUMENT_INCLUDE = { publishedRevision: { select: { content: true, number: true } } } as const

/** Where a collection's screen lives in the console, for links in notifications. */
export const COLLECTION_PATH: Record<Collection, string> = {
  pages: '/admin/website/pages',
  insights: '/admin/website/insights',
  work: '/admin/website/case-studies',
  chrome: '/admin/website/navigation',
}

export function editorPath(doc: Pick<SiteDocument, 'id' | 'template'>): string {
  return `${COLLECTION_PATH[collectionOf(doc.template as DocumentTemplate)]}/${doc.id}`
}

export function templateOf(doc: Pick<SiteDocument, 'template'>): DocumentTemplate {
  if (!isDocumentTemplate(doc.template)) {
    throw createError({ statusCode: 500, message: `Unknown template "${doc.template}"` })
  }
  return doc.template
}

export function isDirty(doc: DocumentRow): boolean {
  return doc.status === 'PUBLISHED' && doc.publishedRevision !== null && doc.publishedRevision.content !== doc.draft
}

export function parseContent(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return null
  }
}

/** "Firstname Lastname", else the email, for a set of user ids. */
export async function namesOf(ids: (string | null | undefined)[], db: Db = prisma): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const users = wanted.length ? await db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, firstName: true, lastName: true, email: true } }) : []
  return new Map(users.map(u => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Staff']))
}

/** One row of the Pages / Insights / Case studies lists. */
export function summarise(doc: DocumentRow, names: Map<string, string>) {
  const template = templateOf(doc)
  const dirty = isDirty(doc)
  const chip = statusChip(doc.status as DocumentStatus, doc.review as ReviewState, dirty)
  const content = isBuiltTemplate(template) ? parseContent(doc.draft) as { meta?: Record<string, unknown> } | null : null
  return {
    id: doc.id,
    title: doc.title,
    path: doc.kind === 'page' ? doc.key : null,
    template,
    collection: collectionOf(template),
    type: documentTypeLabel(template),
    built: isBuiltTemplate(template),
    meta: content?.meta ?? null,
    status: doc.status as DocumentStatus,
    review: doc.review as ReviewState,
    dirty,
    chip,
    updatedAt: doc.draftUpdatedAt.toISOString(),
    updatedBy: doc.draftUpdatedById ? names.get(doc.draftUpdatedById) ?? null : null,
    submittedBy: doc.submittedById ? names.get(doc.submittedById) ?? null : null,
    publishedAt: doc.publishedAt?.toISOString() ?? null,
  }
}

export async function loadDocument(id: string, db: Db = prisma): Promise<DocumentRow> {
  const doc = await db.siteDocument.findUnique({ where: { id }, include: DOCUMENT_INCLUDE })
  if (!doc || doc.archivedAt) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }
  return doc
}

/**
 * Whether `role` may change the draft now. While a document waits for
 * review only someone who can publish may touch it (the design's
 * "Fields are locked so the reviewer sees what you submitted").
 */
export function assertDraftOpen(doc: DocumentRow, role: StaffRole) {
  if (doc.review === 'IN_REVIEW' && !can(role, 'website.publish')) {
    throw createError({ statusCode: 409, message: 'This is waiting for review. Withdraw it to keep editing.', data: { reason: 'in_review' } })
  }
}

/** Validate content for a document's template; a 400 with paths the editor can point at. */
export function checkedContent(template: DocumentTemplate, content: unknown): string {
  const result = validateDocumentContent(template, content)
  if (!result.ok) {
    throw createError({
      statusCode: 400,
      message: 'Some fields need attention',
      data: { fieldErrors: Object.fromEntries(result.issues.map(issue => [issue.path || '_', [issue.message]])) },
    })
  }
  return JSON.stringify(result.content)
}

/** Keep `SiteMediaRef` in step with the images a slot's content names. */
export async function syncMediaRefs(db: Db, documentId: string, slot: 'draft' | 'published', template: DocumentTemplate, contentJson: string) {
  await db.siteMediaRef.deleteMany({ where: { documentId, slot } })
  if (!isBuiltTemplate(template)) {
    return
  }
  const content = parseContent(contentJson) as { sections?: Parameters<typeof sectionMediaIds>[0] } | null
  const ids = sectionMediaIds(content?.sections ?? [])
  if (!ids.length) {
    return
  }
  const known = await db.siteMedia.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
  if (known.length) {
    await db.siteMediaRef.createMany({ data: known.map(m => ({ mediaId: m.id, documentId, slot })) })
  }
}

/** The next revision number of a document. */
async function nextRevisionNumber(db: Db, documentId: string): Promise<number> {
  const last = await db.siteRevision.findFirst({ where: { documentId }, orderBy: { number: 'desc' }, select: { number: true } })
  return (last?.number ?? 0) + 1
}

/**
 * Publish the current draft: a new revision, the live pointer moved to it,
 * the review closed. Returns the revision number.
 */
export async function publishDraft(db: Db, doc: DocumentRow, actorId: string, note: string | null): Promise<number> {
  const number = await nextRevisionNumber(db, doc.id)
  const now = new Date()
  const revision = await db.siteRevision.create({
    data: { documentId: doc.id, number, content: doc.draft, note, authorId: actorId, publishedAt: now },
  })
  await db.siteDocument.update({
    where: { id: doc.id },
    data: { status: 'PUBLISHED', review: 'NONE', submittedById: null, publishedRevisionId: revision.id, publishedAt: now, publishedById: actorId, lastPublishError: null },
  })
  await syncMediaRefs(db, doc.id, 'published', templateOf(doc), doc.draft)
  return number
}

/**
 * Ask the site to drop its cached content so a publish shows on the next
 * request. Best effort: without it the site catches up within a minute
 * (its cache life), so a failure is reported, never thrown.
 */
export async function revalidateSite(event: H3Event): Promise<boolean> {
  const config = useRuntimeConfig(event).website as { siteUrl?: string, revalidateSecret?: string } | undefined
  const url = (config?.siteUrl ?? '').replace(/\/$/, '')
  if (!url || !config?.revalidateSecret) {
    return false
  }
  try {
    const res = await fetch(`${url}/api/cms/revalidate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.revalidateSecret}` },
      signal: AbortSignal.timeout(4000),
    })
    return res.ok
  }
  catch {
    return false
  }
}

/** The site's code baseline, read over HTTP from the site itself. */
export async function fetchSiteBaseline(event: H3Event): Promise<{ template: string, key: string, title: string, content: unknown }[]> {
  const config = useRuntimeConfig(event).website as { siteUrl?: string } | undefined
  const url = (config?.siteUrl ?? '').replace(/\/$/, '')
  if (!url) {
    throw createError({ statusCode: 503, message: 'The public site address is not configured (NUXT_WEBSITE_SITE_URL).' })
  }
  try {
    const res = await fetch(`${url}/api/cms/baseline`, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const body = await res.json() as { documents?: { template: string, key: string, title: string, content: unknown }[] }
    return body.documents ?? []
  }
  catch (error) {
    throw createError({ statusCode: 502, message: `The public site did not answer (${(error as Error).message}). Try again in a minute.` })
  }
}

/** The kind a template's documents are stored under. */
export function kindOf(template: DocumentTemplate): 'page' | 'global' {
  return !isBuiltTemplate(template) && TEMPLATES[template].kind === 'global' ? 'global' : 'page'
}

/**
 * The first draft of a new built document: the design's starting sections
 * (`buildDoc`), with the headline set to the title. Words the author has
 * to write are left empty, so a save asks for them rather than publishing
 * placeholder text.
 */
export function starterContent(template: 'built-page' | 'built-article' | 'built-case-study', title: string) {
  let n = 0
  const section = (type: string, fields: Record<string, string>) => {
    n += 1
    return { id: `s${n}`, type, hidden: false, fields }
  }
  const cta = section('cta', { title: 'Ready when you are', body: 'A 20-minute call. No obligation, no hard sell.', button: 'Book a free call', buttonLink: '/contact' })
  const hero = (eyebrow: string, primary: string) => section('hero', { eyebrow, title, body: '', primary, primaryLink: primary ? '/contact' : '', secondary: '', secondaryLink: '' })
  const seo = { title: '', description: '', canonical: '', robots: 'index,follow', ogTitle: '', ogDescription: '' }
  if (template === 'built-article') {
    return { sections: [hero('', 'Talk to us'), section('text', { heading: 'The short version', body: '' }), cta], seo, meta: { category: 'websites', readMinutes: 5, summary: '' } }
  }
  if (template === 'built-case-study') {
    return { sections: [hero('Case study', 'Start a similar project'), section('image', { media: '', caption: '' }), section('text', { heading: 'The brief', body: '' }), section('text', { heading: 'What we did', body: '' }), cta], seo, meta: { sector: '', service: '', summary: '' } }
  }
  return { sections: [hero('Apex Digital', 'Book a free call'), section('text', { heading: '', body: '' }), cta], seo, meta: {} }
}

/** The purpose a draft-preview token is signed for (`documents/:id/preview`, `/api/site/preview/:token`). */
export const PREVIEW_PURPOSE = 'site-preview'

/** What the public read endpoints return for one document. */
export function publicDocument(doc: Pick<SiteDocument, 'id' | 'kind' | 'template' | 'key' | 'title' | 'publishedAt'>, content: string, revision: number | null) {
  return {
    id: doc.id,
    kind: doc.kind,
    template: doc.template,
    key: doc.key,
    title: doc.title,
    revision,
    publishedAt: doc.publishedAt?.toISOString() ?? null,
    content: parseContent(content),
  }
}
