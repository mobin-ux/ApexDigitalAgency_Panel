import type { Prisma } from '@prisma/client'
import type { H3Event } from 'h3'
import type { DisplayStatus, TemplateDef, TemplateKey, WorkflowAction, WorkflowDoc } from '../../../shared/cms'
import type { AuditActor } from '../audit'
import { createError } from 'h3'
import { availableActions, displayStatus, isSafeInternalPath, isTemplateKey, LEGAL_KEYS, normalisePath, TEMPLATES, validateContent } from '../../../shared/cms'
import { recordAudit } from '../audit'
import prisma from '../prisma'

/**
 * The document store behind the website CMS (ADR-021): create, load, save a
 * draft, list. The lifecycle (publish, schedule, archive …) is in
 * publish.ts; this file never changes `status` or `review`.
 *
 * Content is JSON text validated against the shared contract before it is
 * written. A draft save is optimistic: it names the version it edited, and a
 * stale save is a 409 that says who saved in between.
 */

export type DocumentRow = Prisma.SiteDocumentGetPayload<{ include: typeof WITH_PUBLISHED }>

export const WITH_PUBLISHED = {
  publishedRevision: { select: { id: true, number: true, content: true, publishedAt: true } },
  // One row is enough to know the document has been live at some point.
  revisions: { where: { publishedAt: { not: null } }, select: { id: true }, take: 1 },
} as const

/**
 * Addresses a landing page may not take: the pages the site renders from
 * code and the prefixes its router and server own. A landing page at one of
 * these would be unreachable or would shadow a real page.
 */
const RESERVED_PATHS = new Set(['/', '/services', '/our-work', '/insights', '/about', '/contact'])
const RESERVED_PREFIXES = ['/services/', '/our-work/', '/insights/', '/api/', '/preview/', '/_nuxt/', '/_ipx/', '/media/', '/fonts/', '/brand/', '/icons/']

export function isReservedPath(path: string): boolean {
  return RESERVED_PATHS.has(path) || RESERVED_PREFIXES.some(prefix => path.startsWith(prefix))
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  }
  catch {
    return null
  }
}

export function workflowDocOf(doc: DocumentRow): WorkflowDoc {
  return {
    status: doc.status as WorkflowDoc['status'],
    review: doc.review as WorkflowDoc['review'],
    publishedRevisionId: doc.publishedRevisionId,
    scheduledRevisionId: doc.scheduledRevisionId,
    scheduledFor: doc.scheduledFor,
    draftChanged: doc.publishedRevision ? doc.publishedRevision.content !== doc.draft : true,
    everPublished: doc.revisions.length > 0,
    lastPublishError: doc.lastPublishError,
  }
}

export interface DocumentSummary {
  id: string
  kind: string
  template: TemplateKey
  templateLabel: string
  key: string
  title: string
  state: DisplayStatus
  review: string
  draftVersion: number
  draftUpdatedAt: Date
  draftUpdatedById: string | null
  publishedAt: Date | null
  scheduledFor: Date | null
  lastPublishError: string | null
  revalidatePending: boolean
  actions: WorkflowAction[]
}

export function summarise(doc: DocumentRow): DocumentSummary {
  const template = doc.template as TemplateKey
  return {
    id: doc.id,
    kind: doc.kind,
    template,
    templateLabel: isTemplateKey(template) ? TEMPLATES[template].label : template,
    key: doc.key,
    title: doc.title,
    state: displayStatus(workflowDocOf(doc)),
    review: doc.review,
    draftVersion: doc.draftVersion,
    draftUpdatedAt: doc.draftUpdatedAt,
    draftUpdatedById: doc.draftUpdatedById,
    publishedAt: doc.publishedAt,
    scheduledFor: doc.scheduledFor,
    lastPublishError: doc.lastPublishError,
    revalidatePending: doc.revalidatePending,
    actions: availableActions(workflowDocOf(doc)),
  }
}

export async function loadDocument(id: string): Promise<DocumentRow> {
  const doc = await prisma.siteDocument.findUnique({ where: { id }, include: WITH_PUBLISHED })
  if (!doc) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }
  return doc
}

/** The validation failure shape the admin editor maps onto fields: `data.fieldErrors`. */
export function contentError(issues: { path: string, message: string }[]): never {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues) {
    (fieldErrors[issue.path || '_'] ??= []).push(issue.message)
  }
  throw createError({
    statusCode: 400,
    statusMessage: 'Validation failed',
    message: issues[0] ? `${issues[0].path ? `${issues[0].path}: ` : ''}${issues[0].message}` : 'Invalid content',
    data: { fieldErrors, formErrors: [] },
  })
}

/** Normalise and check the address a page document lives at. */
export function pageKey(template: TemplateKey, raw: string): string {
  const def = TEMPLATES[template] as TemplateDef
  if (def.kind === 'panel' && !def.fixedKey) {
    // A legal document is one of the two the panel renders.
    if (!(LEGAL_KEYS as readonly string[]).includes(raw)) {
      throw createError({ statusCode: 400, message: `A legal document is one of: ${LEGAL_KEYS.join(', ')}.` })
    }
    return raw
  }
  if (def.kind !== 'page') {
    return def.fixedKey ?? template
  }
  if (def.fixedKey) {
    return def.fixedKey
  }
  const key = normalisePath(raw)
  if (!isSafeInternalPath(key) || key.includes('?') || key.includes('#')) {
    throw createError({ statusCode: 400, message: 'The address must be a path on the site, such as /offers/spring, with no query or anchor.' })
  }
  if (isReservedPath(key)) {
    throw createError({ statusCode: 409, message: 'That address belongs to a page the site renders from code.' })
  }
  return key
}

export interface CreateInput {
  template: TemplateKey
  key?: string
  title: string
  content: unknown
  note?: string
}

export async function createDocument(event: H3Event, actor: AuditActor, input: CreateInput): Promise<DocumentRow> {
  const def = TEMPLATES[input.template]
  const check = validateContent(input.template, input.content)
  if (!check.ok) {
    contentError(check.issues)
  }
  const kind = def.kind
  const key = pageKey(input.template, input.key ?? '')
  const existing = await prisma.siteDocument.findUnique({ where: { kind_key: { kind, key } }, select: { id: true, title: true } })
  if (existing) {
    throw createError({ statusCode: 409, message: `"${existing.title}" already lives at ${key}.`, data: { documentId: existing.id } })
  }
  const content = JSON.stringify(check.content)
  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.siteDocument.create({
      data: {
        kind,
        template: input.template,
        key,
        title: input.title.trim(),
        draft: content,
        draftUpdatedById: actor.id,
        createdById: actor.id,
      },
    })
    await tx.siteRevision.create({
      data: { documentId: created.id, number: 1, content, note: input.note ?? null, authorId: actor.id },
    })
    return tx.siteDocument.findUniqueOrThrow({ where: { id: created.id }, include: WITH_PUBLISHED })
  })
  await recordAudit(event, actor, {
    action: 'admin.website.document.create',
    targetType: 'SiteDocument',
    targetId: doc.id,
    subject: doc.title,
    metadata: { template: input.template, key },
  })
  return doc
}

export interface SaveInput {
  version: number
  content: unknown
  title?: string
  note?: string
}

export async function saveDraft(event: H3Event, actor: AuditActor, id: string, input: SaveInput): Promise<DocumentRow> {
  const doc = await loadDocument(id)
  if (doc.status === 'ARCHIVED') {
    throw createError({ statusCode: 409, message: 'Restore the document before editing it.' })
  }
  const template = doc.template as TemplateKey
  const check = validateContent(template, input.content)
  if (!check.ok) {
    contentError(check.issues)
  }
  const content = JSON.stringify(check.content)
  const title = input.title?.trim() || doc.title

  const saved = await prisma.$transaction(async (tx) => {
    const claimed = await tx.siteDocument.updateMany({
      where: { id, draftVersion: input.version },
      data: {
        draft: content,
        title,
        draftVersion: { increment: 1 },
        draftUpdatedAt: new Date(),
        draftUpdatedById: actor.id,
        // A new draft reopens review: what was approved is not what is saved now.
        review: 'NONE',
      },
    })
    if (claimed.count === 0) {
      return null
    }
    const last = await tx.siteRevision.findFirst({ where: { documentId: id }, orderBy: { number: 'desc' }, select: { number: true, content: true } })
    const number = (last?.number ?? 0) + 1
    if (last?.content !== content) {
      await tx.siteRevision.create({ data: { documentId: id, number, content, note: input.note ?? null, authorId: actor.id } })
    }
    return tx.siteDocument.findUniqueOrThrow({ where: { id }, include: WITH_PUBLISHED })
  })

  if (!saved) {
    const current = await loadDocument(id)
    throw createError({
      statusCode: 409,
      statusMessage: 'Stale draft',
      message: 'Someone saved a newer draft while you were editing. Reload to see it; your changes are not lost from this screen.',
      data: { currentVersion: current.draftVersion, updatedById: current.draftUpdatedById, updatedAt: current.draftUpdatedAt },
    })
  }

  await recordAudit(event, actor, {
    action: 'admin.website.document.save',
    targetType: 'SiteDocument',
    targetId: id,
    subject: saved.title,
    metadata: { revision: await prisma.siteRevision.count({ where: { documentId: id } }), version: saved.draftVersion },
  })
  return saved
}

export async function restoreRevision(event: H3Event, actor: AuditActor, id: string, number: number): Promise<DocumentRow> {
  const doc = await loadDocument(id)
  const revision = await prisma.siteRevision.findUnique({ where: { documentId_number: { documentId: id, number } } })
  if (!revision) {
    throw createError({ statusCode: 404, message: 'Revision not found' })
  }
  const restored = await saveDraft(event, actor, id, {
    version: doc.draftVersion,
    content: parseJson(revision.content),
    note: `Restored revision ${number}`,
  })
  await recordAudit(event, actor, {
    action: 'admin.website.document.restore-revision',
    targetType: 'SiteDocument',
    targetId: id,
    subject: restored.title,
    metadata: { revision: number },
  })
  return restored
}

/** A copy of a free page or legal document as a new draft at a free address. */
export async function duplicateDocument(event: H3Event, actor: AuditActor, id: string, input: { key?: string, title?: string }): Promise<DocumentRow> {
  const doc = await loadDocument(id)
  const template = doc.template as TemplateKey
  const def = TEMPLATES[template] as TemplateDef
  if (def.fixedKey) {
    throw createError({ statusCode: 409, message: 'This document exists once and cannot be duplicated.' })
  }
  const key = input.key ?? (doc.kind === 'page' ? `${doc.key}-copy` : doc.key)
  const copy = await createDocument(event, actor, {
    template,
    key,
    title: input.title ?? `Copy of ${doc.title}`,
    content: parseJson(doc.draft),
    note: `Duplicated from ${doc.key}`,
  })
  await recordAudit(event, actor, { action: 'admin.website.document.duplicate', targetType: 'SiteDocument', targetId: copy.id, subject: copy.title, metadata: { from: doc.key, to: key } })
  return copy
}

/**
 * Move a page to a new address. If it was ever published, a 301 from the
 * old address is created so links keep working; the site is told to drop
 * both. Fixed-key documents cannot move.
 */
export async function changeKey(event: H3Event, actor: AuditActor, id: string, rawKey: string): Promise<{ doc: DocumentRow, redirect: boolean }> {
  const doc = await loadDocument(id)
  const template = doc.template as TemplateKey
  const def = TEMPLATES[template] as TemplateDef
  if (def.kind !== 'page' || def.fixedKey) {
    throw createError({ statusCode: 409, message: 'This document has a fixed address.' })
  }
  const key = pageKey(template, rawKey)
  if (key === doc.key) {
    return { doc, redirect: false }
  }
  const clash = await prisma.siteDocument.findUnique({ where: { kind_key: { kind: 'page', key } }, select: { title: true } })
  if (clash) {
    throw createError({ statusCode: 409, message: `"${clash.title}" already lives at ${key}.` })
  }
  const wasLive = doc.revisions.length > 0
  const updated = await prisma.$transaction(async (tx) => {
    await tx.siteDocument.update({ where: { id }, data: { key, revalidatePending: doc.status === 'PUBLISHED' } })
    if (wasLive) {
      await tx.siteRedirect.upsert({
        where: { fromPath: doc.key },
        create: { fromPath: doc.key, toPath: key, statusCode: 301, enabled: true, note: `Moved "${doc.title}"`, createdById: actor.id },
        update: { toPath: key, enabled: true, note: `Moved "${doc.title}"` },
      })
      // A redirect that pointed at the old address now points at the new one.
      await tx.siteRedirect.updateMany({ where: { toPath: doc.key }, data: { toPath: key } })
    }
    return tx.siteDocument.findUniqueOrThrow({ where: { id }, include: WITH_PUBLISHED })
  })
  await recordAudit(event, actor, { action: 'admin.website.document.key', targetType: 'SiteDocument', targetId: id, subject: updated.title, metadata: { from: doc.key, to: key, redirect: wasLive } })
  return { doc: updated, redirect: wasLive }
}

/** Everything the editor screen needs for one document. */
export async function documentDetail(id: string) {
  const doc = await loadDocument(id)
  const [revisions, scheduled, authors] = await Promise.all([
    prisma.siteRevision.findMany({
      where: { documentId: id },
      orderBy: { number: 'desc' },
      select: { id: true, number: true, note: true, authorId: true, createdAt: true, publishedAt: true },
      take: 50,
    }),
    doc.scheduledRevisionId ? prisma.siteRevision.findUnique({ where: { id: doc.scheduledRevisionId }, select: { id: true, number: true } }) : null,
    prisma.user.findMany({
      where: { id: { in: [...new Set([doc.draftUpdatedById, doc.publishedById, doc.createdById].filter((v): v is string => Boolean(v)))] } },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ])
  const authorIds = new Set(revisions.map(r => r.authorId))
  const revisionAuthors = authorIds.size
    ? await prisma.user.findMany({ where: { id: { in: [...authorIds] } }, select: { id: true, firstName: true, lastName: true, email: true } })
    : []
  const people = Object.fromEntries([...authors, ...revisionAuthors].map(u => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id]))

  return {
    ...summarise(doc),
    draft: parseJson(doc.draft),
    published: doc.publishedRevision ? { number: doc.publishedRevision.number, publishedAt: doc.publishedRevision.publishedAt, content: parseJson(doc.publishedRevision.content) } : null,
    scheduled: scheduled ? { number: scheduled.number, scheduledFor: doc.scheduledFor } : null,
    revisions: revisions.map(r => ({ ...r, author: people[r.authorId] ?? r.authorId })),
    people,
    createdAt: doc.createdAt,
    publishAttempts: doc.publishAttempts,
  }
}
