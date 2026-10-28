import type { Prisma } from '@prisma/client'
import type { MailContent } from './render'
import { createLogger } from '../logger'
import prisma from '../prisma'
import { renderHtml, renderText } from './render'
import { MAX_ATTEMPTS, nextAttemptFor } from './schedule'
import { mailConfigured, MailTransportError, sendViaResend } from './transport'

/**
 * The durable outbox (ADR-022). A message is a row before it is anything
 * else: `enqueueMail` writes it (inside the caller's transaction when one
 * is passed, so a business change and its email commit together), then
 * `deliverNow` makes one immediate attempt after the commit and the
 * `mail:deliver` task retries whatever is still queued, every minute, with
 * a growing wait and a cap. A row is SENT only once the provider returned
 * an id; everything the UI says about an email reads that status.
 *
 * Same shape as the website scheduler: each attempt claims its row with a
 * conditional update, and no transaction is held across the network call.
 */

const log = createLogger('mail')

export const MAIL_KINDS = ['password-reset', 'verify-email', 'staff-invite', 'notification', 'cms-review', 'test'] as const
export type MailKind = typeof MAIL_KINDS[number]

export const MAIL_STATUSES = ['QUEUED', 'SENDING', 'SENT', 'FAILED'] as const
export type MailStatus = typeof MAIL_STATUSES[number]

/** A row left SENDING this long was abandoned by a crashed process and may be claimed again. */
const SENDING_STALE_MS = 2 * 60_000

export const NOT_CONFIGURED_ERROR = 'Mail is not configured'

/**
 * Kinds whose link dies with its token. Retrying one of these later would
 * send a link that no longer works; the person has to ask for a new one.
 */
export const DEAD_ON_RETRY: ReadonlySet<string> = new Set<MailKind>(['password-reset', 'verify-email'])

const RETENTION = { SENT: 30, FAILED: 90 } as const

type Db = Prisma.TransactionClient | typeof prisma

export interface Brand {
  siteName: string
  supportEmail: string
}

const BRAND_DEFAULTS = { 'general.site-name': 'Apex Digital Agency', 'general.support-email': 'support@apexdigi.co.uk' }

/**
 * The two settings every template needs. Read through the caller's client
 * so a read inside a transaction uses that transaction (a query on the
 * main client while one is open waits for it on SQLite).
 */
export async function loadBrand(db: Db = prisma): Promise<Brand> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(BRAND_DEFAULTS) } } })
  const values: Record<string, unknown> = { ...BRAND_DEFAULTS }
  for (const row of rows) {
    try {
      values[row.key] = JSON.parse(row.value)
    }
    catch {
      // keep the default
    }
  }
  const siteName = typeof values['general.site-name'] === 'string' && values['general.site-name'] ? values['general.site-name'] : BRAND_DEFAULTS['general.site-name']
  const supportEmail = typeof values['general.support-email'] === 'string' && values['general.support-email'] ? values['general.support-email'] : BRAND_DEFAULTS['general.support-email']
  return { siteName, supportEmail }
}

export interface EnqueueInput {
  to: string
  toUserId?: string | null
  kind: MailKind
  subject: string
  content: MailContent
  /** Defaults to the support address; pass null for none. */
  replyTo?: string | null
}

/** Render and queue one message. Returns the row id; nothing is sent yet. */
export async function enqueueMail(input: EnqueueInput, db: Db = prisma): Promise<{ id: string }> {
  const text = renderText(input.content)
  const html = renderHtml(input.content)
  const replyTo = input.replyTo === undefined ? (await loadBrand(db)).supportEmail : input.replyTo
  return db.mailMessage.create({
    data: {
      to: input.to.trim(),
      toUserId: input.toUserId ?? null,
      kind: input.kind,
      subject: input.subject,
      text,
      html,
      replyTo: replyTo || null,
    },
    select: { id: true },
  })
}

export interface DeliveryOutcome {
  id: string
  status: MailStatus
  error: string | null
}

/**
 * One attempt on one row. Claims it (QUEUED, or a stale SENDING) with a
 * conditional update; a row something else has claimed returns null.
 */
async function attempt(id: string, from: MailStatus[], now: Date): Promise<DeliveryOutcome | null> {
  const claimed = await prisma.mailMessage.updateMany({ where: { id, status: { in: from } }, data: { status: 'SENDING' } })
  if (claimed.count === 0) {
    return null
  }
  const row = await prisma.mailMessage.findUnique({ where: { id } })
  if (!row) {
    return null
  }

  if (!mailConfigured()) {
    // Not an attempt: the row keeps its count and a retry after the keys are set starts afresh.
    await prisma.mailMessage.update({ where: { id }, data: { status: 'FAILED', lastError: NOT_CONFIGURED_ERROR } })
    return { id, status: 'FAILED', error: NOT_CONFIGURED_ERROR }
  }

  const attempts = row.attempts + 1
  try {
    const { providerId } = await sendViaResend(row)
    await prisma.mailMessage.update({ where: { id }, data: { status: 'SENT', attempts, providerId, sentAt: now, lastError: null } })
    log.info('sent', { id, kind: row.kind, attempt: attempts })
    return { id, status: 'SENT', error: null }
  }
  catch (error) {
    const retryable = error instanceof MailTransportError ? error.retryable : false
    const message = ((error as Error).message || 'Unknown error').slice(0, 300)
    const failed = !retryable || attempts >= MAX_ATTEMPTS
    await prisma.mailMessage.update({
      where: { id },
      data: { status: failed ? 'FAILED' : 'QUEUED', attempts, lastError: message, ...(failed ? {} : { nextAttemptAt: nextAttemptFor(attempts, now) }) },
    })
    log.warn(failed ? 'failed' : 'requeued', { id, kind: row.kind, attempt: attempts, retryable })
    return { id, status: failed ? 'FAILED' : 'QUEUED', error: message }
  }
}

/**
 * Try the given rows right away, after the caller's transaction committed.
 * Awaited where the screen reports the result (an invite), fire-and-forget
 * for fan-outs; either way the scheduler picks up anything still queued.
 */
export async function deliverNow(ids: string[]): Promise<DeliveryOutcome[]> {
  const now = new Date()
  const outcomes: DeliveryOutcome[] = []
  for (const id of ids) {
    try {
      const outcome = await attempt(id, ['QUEUED'], now)
      if (outcome) {
        outcomes.push(outcome)
      }
    }
    catch (error) {
      log.error('delivery threw', { id, error: (error as Error).message })
    }
  }
  return outcomes
}

/** Re-queue a FAILED row so the next attempt runs now. False if it was not FAILED. */
export async function requeueMail(id: string): Promise<boolean> {
  const updated = await prisma.mailMessage.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'QUEUED', nextAttemptAt: new Date(), lastError: null } })
  return updated.count > 0
}

export interface DeliverQueuedResult {
  sent: number
  requeued: number
  failed: number
  pruned: number
}

/**
 * The task body: every row whose time has come, oldest first, in one batch
 * of `limit`, plus any row abandoned mid-send. Then the retention sweep.
 */
export async function deliverQueued(now = new Date(), limit = 50): Promise<DeliverQueuedResult> {
  const due = await prisma.mailMessage.findMany({
    where: {
      OR: [
        { status: 'QUEUED', nextAttemptAt: { lte: now } },
        { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - SENDING_STALE_MS) } },
      ],
    },
    select: { id: true },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  })

  const result: DeliverQueuedResult = { sent: 0, requeued: 0, failed: 0, pruned: 0 }
  for (const { id } of due) {
    try {
      const outcome = await attempt(id, ['QUEUED', 'SENDING'], now)
      if (outcome?.status === 'SENT') {
        result.sent += 1
      }
      else if (outcome?.status === 'QUEUED') {
        result.requeued += 1
      }
      else if (outcome?.status === 'FAILED') {
        result.failed += 1
      }
    }
    catch (error) {
      log.error('delivery threw', { id, error: (error as Error).message })
    }
  }

  const day = 24 * 60 * 60_000
  const pruned = await prisma.mailMessage.deleteMany({
    where: {
      OR: [
        { status: 'SENT', sentAt: { lt: new Date(now.getTime() - RETENTION.SENT * day) } },
        { status: 'FAILED', updatedAt: { lt: new Date(now.getTime() - RETENTION.FAILED * day) } },
      ],
    },
  }).catch(() => ({ count: 0 }))
  result.pruned = pruned.count
  return result
}
