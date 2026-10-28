import { isHttpsUrl, isSafeInternalPath } from '../../../shared/cms'
import prisma from '../prisma'
import { parseJson } from './documents'
import { collectMediaIds } from './media'

/**
 * Issues a publisher should know about, over the published documents and
 * the redirects: missing or over-long titles and descriptions, duplicate
 * titles, canonicals that leave the site, pages hidden from search,
 * redirect loops or disabled chains, and images without alt text.
 * Informational, never blocking: the rules are what Google documents, not
 * what this panel enforces at save time.
 */

export interface SeoIssue {
  severity: 'error' | 'warning' | 'info'
  kind: string
  message: string
  documentId?: string
  documentTitle?: string
  key?: string
  redirectId?: string
}

const TITLE_MAX = 60
const DESCRIPTION_MAX = 155

export async function seoAudit(): Promise<{ issues: SeoIssue[], checked: { documents: number, redirects: number } }> {
  const issues: SeoIssue[] = []
  const docs = await prisma.siteDocument.findMany({
    where: { kind: 'page', status: 'PUBLISHED', publishedRevisionId: { not: null } },
    select: { id: true, key: true, title: true, template: true, publishedRevision: { select: { content: true } } },
  })
  const titles = new Map<string, string[]>()
  const links = new Set<string>()
  const mediaIds = new Set<string>()
  for (const doc of docs) {
    const content = parseJson(doc.publishedRevision?.content ?? '') as { seo?: Record<string, unknown>, title?: string } | null
    const seo = content?.seo ?? {}
    const title = String(seo.title ?? '').trim()
    const description = String(seo.description ?? '').trim()
    const canonical = String(seo.canonical ?? '').trim()
    const robots = String(seo.robots ?? 'index,follow')
    const base = { documentId: doc.id, documentTitle: doc.title, key: doc.key }
    if (!title) {
      issues.push({ ...base, severity: 'warning', kind: 'title-missing', message: 'No search title: the site default is used.' })
    }
    else if (title.length > TITLE_MAX) {
      issues.push({ ...base, severity: 'info', kind: 'title-long', message: `Search title is ${title.length} characters; Google shows about ${TITLE_MAX}.` })
    }
    if (!description) {
      issues.push({ ...base, severity: 'warning', kind: 'description-missing', message: 'No search description: the site default is used.' })
    }
    else if (description.length > DESCRIPTION_MAX) {
      issues.push({ ...base, severity: 'info', kind: 'description-long', message: `Description is ${description.length} characters; Google shows about ${DESCRIPTION_MAX}.` })
    }
    if (canonical && !isSafeInternalPath(canonical) && !isHttpsUrl(canonical)) {
      issues.push({ ...base, severity: 'error', kind: 'canonical-invalid', message: 'Canonical address is neither a site path nor an https address.' })
    }
    else if (canonical && isHttpsUrl(canonical)) {
      issues.push({ ...base, severity: 'info', kind: 'canonical-external', message: `Canonical points off-site (${canonical}); search engines will credit that address.` })
    }
    if (robots.startsWith('noindex')) {
      issues.push({ ...base, severity: 'info', kind: 'noindex', message: 'Hidden from search engines by its robots setting.' })
    }
    if (title) {
      titles.set(title, [...(titles.get(title) ?? []), doc.key])
    }
    for (const id of collectMediaIds(content)) {
      mediaIds.add(id)
    }
    for (const link of collectLinks(content)) {
      links.add(link)
    }
  }
  for (const [title, keys] of titles) {
    if (keys.length > 1) {
      issues.push({ severity: 'warning', kind: 'title-duplicate', message: `"${title}" is the search title of ${keys.length} pages: ${keys.join(', ')}.` })
    }
  }

  const redirects = await prisma.siteRedirect.findMany({ select: { id: true, fromPath: true, toPath: true, enabled: true } })
  const enabled = new Map(redirects.filter(r => r.enabled).map(r => [r.fromPath, r.toPath]))
  const publishedKeys = new Set(docs.map(d => d.key))
  for (const r of redirects) {
    if (!r.enabled) {
      continue
    }
    if (enabled.has(r.toPath)) {
      const next = enabled.get(r.toPath)!
      issues.push({ severity: next === r.fromPath ? 'error' : 'warning', kind: next === r.fromPath ? 'redirect-loop' : 'redirect-chain', redirectId: r.id, key: r.fromPath, message: next === r.fromPath ? `${r.fromPath} and ${r.toPath} redirect to each other.` : `${r.fromPath} → ${r.toPath} → ${next}: two hops; point it at ${next}.` })
    }
    if (publishedKeys.has(r.fromPath)) {
      issues.push({ severity: 'warning', kind: 'redirect-shadows-page', redirectId: r.id, key: r.fromPath, message: `A published page lives at ${r.fromPath}, but the redirect answers first.` })
    }
  }

  const internalLinks = [...links].filter(l => l.startsWith('/') && !l.startsWith('//'))
  const knownPrefixes = ['/services', '/our-work', '/insights', '/about', '/contact', '/legal', '/careers']
  for (const link of internalLinks) {
    const path = link.split(/[?#]/)[0]!
    if (path === '/' || publishedKeys.has(path) || enabled.has(path) || knownPrefixes.some(p => path === p || path.startsWith(`${p}/`))) {
      continue
    }
    issues.push({ severity: 'warning', kind: 'link-unknown', key: path, message: `A published document links to ${path}, which is neither a published page nor a redirect.` })
  }

  if (mediaIds.size) {
    const media = await prisma.siteMedia.findMany({ where: { id: { in: [...mediaIds] }, deletedAt: null, mime: { startsWith: 'image/' } }, select: { id: true, filename: true, alt: true } })
    for (const m of media) {
      if (!m.alt.trim()) {
        issues.push({ severity: 'warning', kind: 'media-alt-missing', message: `${m.filename} has no alt text in the library (a document's own alt text is used where it is set).` })
      }
    }
  }

  const order = { error: 0, warning: 1, info: 2 }
  issues.sort((a, b) => order[a.severity] - order[b.severity])
  return { issues, checked: { documents: docs.length, redirects: redirects.length } }
}

/** Every stored link's target (internal paths and https addresses). */
function collectLinks(content: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(content)) {
    for (const item of content) {
      collectLinks(item, out)
    }
  }
  else if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (record.kind === 'internal' && typeof record.path === 'string') {
      out.add(record.path)
    }
    for (const value of Object.values(record)) {
      collectLinks(value, out)
    }
  }
  return out
}
