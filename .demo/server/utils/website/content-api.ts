import type { H3Event } from 'h3'
import type { TemplateDef, TemplateKey } from '../../../shared/cms'
import { setHeader } from 'h3'
import { normalisePath, resolveDocument, TEMPLATES } from '../../../shared/cms'
import { panelAnnouncementBaseline, panelPromoBaseline } from '../../../shared/panel-baseline'
import prisma from '../prisma'
import { parseJson } from './documents'
import { mediaIndex } from './media'

/**
 * What the public content API (`/api/site/**`) answers: published revisions
 * only, never drafts. Read by the site's server over localhost, cached there
 * for 60 s, so the shape here is the contract the site resolves over its
 * code baseline.
 */

export interface PublishedDocument {
  id: string
  kind: string
  template: TemplateKey
  key: string
  title: string
  revision: number
  publishedAt: Date | null
  content: unknown
  /** The files the content refers to, by media id: address, size, alt (filled by `withMedia`). */
  media?: Record<string, { src: string, width: number | null, height: number | null, mime: string, alt: string, filename: string }>
}

export async function withMedia<T extends PublishedDocument | null>(doc: T): Promise<T> {
  if (doc) {
    doc.media = await mediaIndex(doc.content)
  }
  return doc
}

const PUBLISHED_SELECT = {
  id: true,
  kind: true,
  template: true,
  key: true,
  title: true,
  publishedAt: true,
  publishedRevision: { select: { number: true, content: true } },
} as const

function toPublished(row: { id: string, kind: string, template: string, key: string, title: string, publishedAt: Date | null, publishedRevision: { number: number, content: string } | null }): PublishedDocument | null {
  if (!row.publishedRevision) {
    return null
  }
  return {
    id: row.id,
    kind: row.kind,
    template: row.template as TemplateKey,
    key: row.key,
    title: row.title,
    revision: row.publishedRevision.number,
    publishedAt: row.publishedAt,
    content: parseJson(row.publishedRevision.content),
  }
}

/** The published document at a page address, or null. */
export async function publishedPage(path: string): Promise<PublishedDocument | null> {
  const key = normalisePath(path)
  const row = await prisma.siteDocument.findFirst({
    where: { kind: 'page', key, status: 'PUBLISHED', publishedRevisionId: { not: null } },
    select: PUBLISHED_SELECT,
  })
  return withMedia(row ? toPublished(row) : null)
}

/** Every published global (header, footer, announcement, chrome), keyed by template. */
export async function publishedGlobals(): Promise<Record<string, PublishedDocument>> {
  const rows = await prisma.siteDocument.findMany({
    where: { kind: 'global', status: 'PUBLISHED', publishedRevisionId: { not: null } },
    select: PUBLISHED_SELECT,
  })
  const out: Record<string, PublishedDocument> = {}
  for (const row of rows) {
    const doc = toPublished(row)
    if (doc) {
      out[doc.template] = await withMedia(doc)
    }
  }
  return out
}

/** Every published page: address, template, title and when, for the sitemap and the importer. */
export async function manifest() {
  const rows = await prisma.siteDocument.findMany({
    where: { kind: 'page', status: 'PUBLISHED', publishedRevisionId: { not: null } },
    select: { key: true, template: true, title: true, publishedAt: true, updatedAt: true, publishedRevision: { select: { content: true } } },
    orderBy: { key: 'asc' },
  })
  return rows.map((row) => {
    const content = parseJson(row.publishedRevision?.content ?? '') as { seo?: { robots?: string } } | null
    return {
      key: row.key,
      template: row.template,
      title: row.title,
      publishedAt: row.publishedAt,
      landing: !(TEMPLATES[row.template as TemplateKey] as TemplateDef | undefined)?.fixedKey && !['service', 'case-study', 'article'].includes(row.template),
      noindex: typeof content?.seo?.robots === 'string' && content.seo.robots.startsWith('noindex'),
    }
  })
}

export interface PanelContent {
  legal: { terms: PublishedDocument | null, privacy: PublishedDocument | null }
  promo: ReturnType<typeof resolveDocument<'panel-promo'>>['content']
  announcement: ReturnType<typeof resolveDocument<'panel-announcement'>>['content']
}

let panelCache: { at: number, value: PanelContent } | null = null
const PANEL_CACHE_MS = 30_000

/**
 * The published panel documents, resolved over the panel's own baseline,
 * cached in process for 30 s: /api/config is read on every customer page
 * and the documents change rarely. A publish clears the cache directly.
 */
export async function panelContent(): Promise<PanelContent> {
  if (panelCache && Date.now() - panelCache.at < PANEL_CACHE_MS) {
    return panelCache.value
  }
  const rows = await prisma.siteDocument.findMany({
    where: { kind: 'panel', status: 'PUBLISHED', publishedRevisionId: { not: null } },
    select: PUBLISHED_SELECT,
  })
  const docs = rows.map(toPublished).filter((d): d is PublishedDocument => Boolean(d))
  const find = (template: string, key?: string) => docs.find(d => d.template === template && (key === undefined || d.key === key)) ?? null
  const value: PanelContent = {
    legal: { terms: find('legal', 'terms'), privacy: find('legal', 'privacy') },
    promo: resolveDocument('panel-promo', panelPromoBaseline, find('panel-promo')?.content ?? null).content,
    announcement: resolveDocument('panel-announcement', panelAnnouncementBaseline, find('panel-announcement')?.content ?? null).content,
  }
  panelCache = { at: Date.now(), value }
  return value
}

export function clearPanelContentCache(): void {
  panelCache = null
}

/** Public, cacheable: the site's server is the caller and keeps its own 60 s cache on top. */
export function publicCacheHeaders(event: H3Event): void {
  setHeader(event, 'Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
}
