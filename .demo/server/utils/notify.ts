import type { Permission } from '../../shared/permissions'
import type { Db, MailKind } from './mail/outbox'
import { rolesWith } from '../../shared/permissions'
import { deliverNow, enqueueMail, loadBrand } from './mail/outbox'
import { absoluteUrl, MailRenderError } from './mail/render'
import { notificationMail } from './mail/templates'
import { selectRecipients } from './notify-rules'
import prisma from './prisma'

/**
 * One way to tell a person something (ADR-022): the in-app Notification
 * row every call site used to write by hand, plus the email that mirrors
 * it for accounts that have an address and have left notification emails
 * on. Account and security messages pass `always`, which ignores the
 * switch. A suspended account still gets the row (it is their record) and
 * no email.
 *
 * Pass the transaction client when calling inside a transaction, and call
 * `deliverNow(mailIds)` yourself after it commits; with no `tx` the first
 * delivery attempt is fired here, after the rows are written.
 */

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING'

export interface NotifyInput {
  userIds: string[]
  /** At most 200 characters, like every title written before this helper. */
  title: string
  message: string
  type?: NotificationType
  /** An in-app path (`/dashboards/…`, `/admin/…`); the email gets it as an absolute link. */
  link?: string | null
  /** Account and security notices: email even when notification emails are off. */
  always?: boolean
  /** Leave the person who caused the event out (a reviewer, a replying agent). */
  excludeUserId?: string | null
  /** How the outbox files the email; `notification` unless a flow has its own filter on the Email screen. */
  kind?: Extract<MailKind, 'notification' | 'cms-review'>
}

export interface NotifyResult {
  notified: number
  mailIds: string[]
}

export async function notify(input: NotifyInput, tx?: Db): Promise<NotifyResult> {
  const db = tx ?? prisma
  const ids = [...new Set(input.userIds)].filter(Boolean)
  if (ids.length === 0) {
    return { notified: 0, mailIds: [] }
  }
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, emailNotifications: true, status: true } })
  const { rows, emails } = selectRecipients(users, input)
  if (rows.length === 0) {
    return { notified: 0, mailIds: [] }
  }

  const type = input.type ?? 'INFO'
  const link = input.link ?? null
  await db.notification.createMany({
    data: rows.map(userId => ({ userId, title: input.title.slice(0, 200), message: input.message, type, link })),
  })

  const mailIds: string[] = []
  if (emails.length) {
    const brand = await loadBrand(db)
    let url: string | null = null
    let linkError: string | null = null
    if (link) {
      try {
        url = absoluteUrl(link)
      }
      catch (error) {
        if (!(error instanceof MailRenderError)) {
          throw error
        }
        linkError = error.message
      }
    }
    const draft = notificationMail(brand, { title: input.title, message: input.message, url })
    const kind = input.kind ?? 'notification'
    for (const { id, email } of emails) {
      if (linkError) {
        // The row is written as failed with the reason, where the Email screen shows it; the in-app notification still stands.
        const row = await db.mailMessage.create({ data: { to: email, toUserId: id, kind, subject: draft.subject, text: '', html: '', status: 'FAILED', lastError: linkError.slice(0, 300) }, select: { id: true } })
        mailIds.push(row.id)
        continue
      }
      const row = await enqueueMail({ to: email, toUserId: id, kind, ...draft }, db)
      mailIds.push(row.id)
    }
  }

  if (!tx && mailIds.length) {
    void deliverNow(mailIds)
  }
  return { notified: rows.length, mailIds }
}

/**
 * Every active staff account whose role holds a permission — and the
 * accounts with no `staffRole` yet, which the guard treats as owners.
 */
export async function staffHolding(permission: Permission, db: Db = prisma): Promise<string[]> {
  const roles = rolesWith(permission).map(r => r.key)
  const users = await db.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE', OR: [{ staffRole: { in: roles } }, { staffRole: null }] },
    select: { id: true },
  })
  return users.map(u => u.id)
}

/** `notify()` for everyone holding a permission (a new order for `work.assign`, a draft for `website.publish`). */
export async function notifyRoles(permission: Permission, input: Omit<NotifyInput, 'userIds'>, tx?: Db): Promise<NotifyResult> {
  const userIds = await staffHolding(permission, tx)
  return notify({ ...input, userIds }, tx)
}
