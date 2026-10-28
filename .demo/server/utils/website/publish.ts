import type { H3Event } from 'h3'
import type { TransitionInput, WorkflowAction } from '../../../shared/cms'
import type { AuditActor } from '../audit'
import type { DocumentRow } from './documents'
import { createError } from 'h3'
import { transition } from '../../../shared/cms'
import { recordAudit } from '../audit'
import prisma from '../prisma'
import { loadDocument, WITH_PUBLISHED, workflowDocOf } from './documents'

/**
 * The lifecycle: one function applies a workflow action to a document.
 *
 * `transition()` (shared contract) decides whether the action is allowed and
 * what it means; this file carries it out in one transaction — pointer
 * moves, timestamps, the revision's `publishedAt` — and then tells the site
 * to drop its cache. The site call runs after the commit and is retried by
 * the scheduler if it fails, so a flaky network can delay a publish being
 * visible but can never undo it (the site's 60 s cache bounds the delay).
 */

export interface TransitionResult {
  doc: DocumentRow
  action: WorkflowAction
  revalidated: boolean | null
}

export async function applyTransition(event: H3Event, actor: AuditActor, id: string, action: WorkflowAction, input: TransitionInput = {}): Promise<TransitionResult> {
  const doc = await loadDocument(id)
  const result = transition(workflowDocOf(doc), action, input)
  if (!result.ok) {
    throw createError({ statusCode: 409, message: result.reason })
  }

  const now = new Date()
  const touchesSite = result.effect === 'publish-draft' || result.effect === 'unpublish' || result.effect === 'archive'

  if (result.effect === 'delete') {
    await prisma.siteDocument.delete({ where: { id } })
    await recordAudit(event, actor, { action: result.auditAction, targetType: 'SiteDocument', targetId: id, subject: doc.title, metadata: { key: doc.key } })
    return { doc, action, revalidated: null }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const latest = await tx.siteRevision.findFirst({ where: { documentId: id }, orderBy: { number: 'desc' } })
    if (!latest) {
      throw createError({ statusCode: 500, message: 'The document has no revision to publish.' })
    }
    const base = {
      ...result.patch,
      scheduledFor: result.patch.scheduledFor === undefined ? undefined : result.patch.scheduledFor,
    }
    switch (result.effect) {
      case 'publish-draft':
        await tx.siteRevision.update({ where: { id: latest.id }, data: { publishedAt: now } })
        await tx.siteDocument.update({
          where: { id },
          data: {
            ...base,
            publishedRevisionId: latest.id,
            publishedAt: now,
            publishedById: actor.id,
            scheduledRevisionId: null,
            scheduledFor: null,
            scheduledById: null,
            archivedAt: null,
            lastPublishError: null,
            publishAttempts: 0,
            revalidatePending: true,
          },
        })
        break
      case 'schedule-draft':
        await tx.siteDocument.update({
          where: { id },
          data: { ...base, scheduledRevisionId: latest.id, scheduledById: actor.id, lastPublishError: null, publishAttempts: 0 },
        })
        break
      case 'unschedule':
        await tx.siteDocument.update({
          where: { id },
          data: { ...base, scheduledRevisionId: null, scheduledFor: null, scheduledById: null, lastPublishError: null },
        })
        break
      case 'unpublish':
        await tx.siteDocument.update({
          where: { id },
          data: { ...base, publishedRevisionId: null, publishedAt: null, publishedById: null, scheduledRevisionId: null, scheduledFor: null, revalidatePending: true },
        })
        break
      case 'archive':
        await tx.siteDocument.update({
          where: { id },
          data: { ...base, publishedRevisionId: null, publishedAt: null, scheduledRevisionId: null, scheduledFor: null, archivedAt: now, revalidatePending: doc.status === 'PUBLISHED' },
        })
        break
      case 'none':
        await tx.siteDocument.update({ where: { id }, data: { ...base, archivedAt: action === 'restore' ? null : undefined } })
        break
    }
    return tx.siteDocument.findUniqueOrThrow({ where: { id }, include: WITH_PUBLISHED })
  })

  await recordAudit(event, actor, {
    action: result.auditAction,
    targetType: 'SiteDocument',
    targetId: id,
    subject: updated.title,
    metadata: {
      key: updated.key,
      ...(updated.publishedRevision ? { revision: updated.publishedRevision.number } : {}),
      ...(input.scheduledFor ? { scheduledFor: new Date(input.scheduledFor).toISOString() } : {}),
    },
  })

  let revalidated: boolean | null = null
  if (touchesSite && updated.revalidatePending) {
    revalidated = await revalidateSite([updated.key])
    if (revalidated) {
      await prisma.siteDocument.update({ where: { id }, data: { revalidatePending: false } })
    }
  }
  return { doc: updated, action, revalidated }
}

export interface WebsiteRuntime {
  siteUrl: string
  revalidateSecret: string
}

export function websiteRuntime(): WebsiteRuntime {
  const config = useRuntimeConfig().website as Partial<WebsiteRuntime> | undefined
  return { siteUrl: (config?.siteUrl ?? '').replace(/\/$/, ''), revalidateSecret: config?.revalidateSecret ?? '' }
}

/**
 * Ask the site to drop its content cache. Server to server, over the
 * configured site URL, authenticated by a shared secret. False on any
 * failure: the caller keeps `revalidatePending` set and the scheduler
 * retries. Without a configured site the call is a no-op that returns true,
 * so a panel with no site attached never accumulates "pending" documents.
 */
export async function revalidateSite(paths: string[]): Promise<boolean> {
  const { siteUrl, revalidateSecret } = websiteRuntime()
  if (!siteUrl) {
    return true
  }
  if (!revalidateSecret) {
    return false
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${siteUrl}/api/cms/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${revalidateSecret}` },
      body: JSON.stringify({ paths }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.ok
  }
  catch {
    return false
  }
}

/** Retry every document whose last publish did not reach the site. */
export async function retryRevalidations(): Promise<number> {
  const pending = await prisma.siteDocument.findMany({ where: { revalidatePending: true }, select: { id: true, key: true } })
  if (!pending.length) {
    return 0
  }
  const ok = await revalidateSite(pending.map(p => p.key))
  if (ok) {
    await prisma.siteDocument.updateMany({ where: { id: { in: pending.map(p => p.id) } }, data: { revalidatePending: false } })
  }
  return ok ? pending.length : 0
}
