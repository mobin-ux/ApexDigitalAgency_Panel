import type { H3Event } from 'h3'
import type { AuditActor } from '../audit'
import { createError } from 'h3'
import { isHttpsUrl, isSafeInternalPath, normalisePath } from '../../../shared/cms'
import { recordAudit } from '../audit'
import prisma from '../prisma'

/**
 * Redirects the site answers before routing (ADR-021). `fromPath` is a
 * normalised site path; `toPath` is a site path or an https address. A
 * loop (A → B while B → A, or A → A) is refused; a chain (A → B while
 * B → C) is flattened to A → C so no visitor hops twice.
 */

export const REDIRECT_SELECT = { id: true, fromPath: true, toPath: true, statusCode: true, enabled: true, note: true, createdById: true, createdAt: true, updatedAt: true } as const

export interface RedirectInput {
  fromPath: string
  toPath: string
  statusCode?: 301 | 302
  enabled?: boolean
  note?: string | null
}

function parseFrom(raw: string): string {
  // Normalising would prefix a slash and make `javascript:…` look like a path; the typed value has to be one already.
  const from = raw.trim().startsWith('/') ? normalisePath(raw) : raw.trim()
  if (!isSafeInternalPath(from) || from === '/' || from.includes('?') || from.includes('#')) {
    throw createError({ statusCode: 400, message: 'The old address must be a path on this site (not the homepage), with no query or anchor.', data: { fieldErrors: { fromPath: ['Must be a site path'] }, formErrors: [] } })
  }
  return from
}

function parseTo(raw: string): string {
  const to = raw.trim()
  if (isHttpsUrl(to)) {
    return to
  }
  const path = to.startsWith('/') ? normalisePath(to) : to
  if (!isSafeInternalPath(path)) {
    throw createError({ statusCode: 400, message: 'The new address must be a path on this site or a full https:// address.', data: { fieldErrors: { toPath: ['Must be a site path or https:// address'] }, formErrors: [] } })
  }
  return path
}

/** What saving `from → to` would do, given every other redirect. */
export async function checkRedirect(input: RedirectInput, excludeId?: string): Promise<{ fromPath: string, toPath: string, flattenedFrom?: string, retargets: string[], warnings: string[] }> {
  const fromPath = parseFrom(input.fromPath)
  let toPath = parseTo(input.toPath)
  const warnings: string[] = []
  if (toPath === fromPath) {
    throw createError({ statusCode: 409, message: 'A redirect cannot point at its own address.' })
  }
  const others = await prisma.siteRedirect.findMany({ where: { enabled: true, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, fromPath: true, toPath: true } })
  const byFrom = new Map(others.map(r => [r.fromPath, r.toPath]))
  // Flatten: follow the chain from the target, refusing a loop back to the source.
  let flattenedFrom: string | undefined
  let hops = 0
  while (!toPath.startsWith('https://') && byFrom.has(toPath)) {
    const next = byFrom.get(toPath)!
    if (next === fromPath || hops > 10) {
      throw createError({ statusCode: 409, message: `That would loop: ${toPath} already redirects back to ${fromPath}.` })
    }
    flattenedFrom ??= toPath
    toPath = next
    hops += 1
  }
  if (flattenedFrom) {
    warnings.push(`${flattenedFrom} already redirects on to ${toPath}, so this one points straight there.`)
  }
  // Anything that pointed at the source now points at the destination.
  const retargets = others.filter(r => r.toPath === fromPath).map(r => r.fromPath)
  if (retargets.length) {
    warnings.push(`${retargets.length} redirect${retargets.length === 1 ? '' : 's'} pointing at ${fromPath} will point at ${toPath} instead.`)
  }
  const live = await prisma.siteDocument.findFirst({ where: { kind: 'page', key: fromPath, status: 'PUBLISHED' }, select: { title: true } })
  if (live) {
    warnings.push(`"${live.title}" is published at ${fromPath}; the redirect will win over the page.`)
  }
  return { fromPath, toPath, flattenedFrom, retargets, warnings }
}

export async function createRedirect(event: H3Event, actor: AuditActor, input: RedirectInput) {
  const checked = await checkRedirect(input)
  const existing = await prisma.siteRedirect.findUnique({ where: { fromPath: checked.fromPath }, select: { id: true } })
  if (existing) {
    throw createError({ statusCode: 409, message: `A redirect from ${checked.fromPath} already exists; edit that one.`, data: { redirectId: existing.id } })
  }
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.siteRedirect.create({
      data: { fromPath: checked.fromPath, toPath: checked.toPath, statusCode: input.statusCode ?? 301, enabled: input.enabled ?? true, note: input.note?.trim() || null, createdById: actor.id },
      select: REDIRECT_SELECT,
    })
    if (checked.retargets.length) {
      await tx.siteRedirect.updateMany({ where: { toPath: checked.fromPath }, data: { toPath: checked.toPath } })
    }
    return created
  })
  await recordAudit(event, actor, { action: 'admin.website.redirect.create', targetType: 'SiteRedirect', targetId: row.id, subject: row.fromPath, metadata: { from: row.fromPath, to: row.toPath, statusCode: row.statusCode, retargeted: checked.retargets } })
  return { redirect: row, warnings: checked.warnings }
}

export async function updateRedirect(event: H3Event, actor: AuditActor, id: string, input: Partial<RedirectInput>) {
  const current = await prisma.siteRedirect.findUnique({ where: { id }, select: REDIRECT_SELECT })
  if (!current) {
    throw createError({ statusCode: 404, message: 'Redirect not found' })
  }
  const checked = await checkRedirect({ fromPath: input.fromPath ?? current.fromPath, toPath: input.toPath ?? current.toPath }, id)
  if (checked.fromPath !== current.fromPath) {
    const clash = await prisma.siteRedirect.findUnique({ where: { fromPath: checked.fromPath }, select: { id: true } })
    if (clash) {
      throw createError({ statusCode: 409, message: `A redirect from ${checked.fromPath} already exists.` })
    }
  }
  const row = await prisma.siteRedirect.update({
    where: { id },
    data: { fromPath: checked.fromPath, toPath: checked.toPath, ...(input.statusCode ? { statusCode: input.statusCode } : {}), ...(input.enabled !== undefined ? { enabled: input.enabled } : {}), ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}) },
    select: REDIRECT_SELECT,
  })
  await recordAudit(event, actor, { action: 'admin.website.redirect.update', targetType: 'SiteRedirect', targetId: id, subject: row.fromPath, metadata: { before: current, after: row } })
  return { redirect: row, warnings: checked.warnings }
}

export async function deleteRedirect(event: H3Event, actor: AuditActor, id: string): Promise<void> {
  const current = await prisma.siteRedirect.findUnique({ where: { id }, select: REDIRECT_SELECT })
  if (!current) {
    throw createError({ statusCode: 404, message: 'Redirect not found' })
  }
  await prisma.siteRedirect.delete({ where: { id } })
  await recordAudit(event, actor, { action: 'admin.website.redirect.delete', targetType: 'SiteRedirect', targetId: id, subject: current.fromPath, metadata: { from: current.fromPath, to: current.toPath } })
}

/** The enabled redirects as the site's middleware wants them. */
export async function publicRedirects(): Promise<{ from: string, to: string, status: number }[]> {
  const rows = await prisma.siteRedirect.findMany({ where: { enabled: true }, select: { fromPath: true, toPath: true, statusCode: true }, orderBy: { fromPath: 'asc' } })
  return rows.map(r => ({ from: r.fromPath, to: r.toPath, status: r.statusCode }))
}
