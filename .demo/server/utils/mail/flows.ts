import type { H3Event } from 'h3'
import type { Db, MailKind } from './outbox'
import { signPurposeToken } from '../auth'
import prisma from '../prisma'
import { enqueueMail, loadBrand } from './outbox'
import { absoluteUrl, MailRenderError } from './render'
import { passwordResetMail, staffInviteMail, verifyEmailMail } from './templates'

/**
 * The account emails (ADR-022): what each flow queues, in one place, so the
 * route that creates the token and the route that re-sends it build the
 * same message. Each returns the outbox row id; the caller decides whether
 * to await the first delivery attempt. Every one takes the caller's
 * transaction client when it is queued inside a transaction (see `Db`).
 *
 * A link that cannot be built (no public origin in production) is not an
 * exception for the business change to trip over: the row is written as
 * FAILED with that reason, where the Email screen shows it.
 */

export const VERIFY_EMAIL_PURPOSE = 'verify-email'
export const VERIFY_EMAIL_TTL_HOURS = 24
export const RESET_LINK_TTL_MINUTES = 60

async function unsendable(input: { to: string, toUserId: string | null, kind: MailKind, subject: string, error: string }, db: Db): Promise<{ id: string }> {
  return db.mailMessage.create({
    data: { to: input.to, toUserId: input.toUserId, kind: input.kind, subject: input.subject, text: '', html: '', status: 'FAILED', lastError: input.error.slice(0, 300) },
    select: { id: true },
  })
}

function linkOrError(path: string): { url: string } | { error: string } {
  try {
    return { url: absoluteUrl(path) }
  }
  catch (error) {
    if (error instanceof MailRenderError) {
      return { error: error.message }
    }
    throw error
  }
}

export async function queueVerificationMail(event: H3Event, user: { id: string, email: string, firstName?: string | null }, db: Db = prisma): Promise<{ id: string }> {
  const token = signPurposeToken(event, VERIFY_EMAIL_PURPOSE, { uid: user.id, email: user.email }, VERIFY_EMAIL_TTL_HOURS * 3600)
  const brand = await loadBrand(db)
  const link = linkOrError(`/auth/verify-email?token=${encodeURIComponent(token)}`)
  if ('error' in link) {
    return unsendable({ to: user.email, toUserId: user.id, kind: 'verify-email', subject: `${brand.siteName}: confirm your email address`, error: link.error }, db)
  }
  const draft = verifyEmailMail(brand, { name: user.firstName ?? null, url: link.url, expiresHours: VERIFY_EMAIL_TTL_HOURS })
  return enqueueMail({ to: user.email, toUserId: user.id, kind: 'verify-email', ...draft }, db)
}

export async function queuePasswordResetMail(user: { id: string, email: string }, token: string, db: Db = prisma): Promise<{ id: string }> {
  const brand = await loadBrand(db)
  const link = linkOrError(`/auth/recover?token=${encodeURIComponent(token)}`)
  if ('error' in link) {
    return unsendable({ to: user.email, toUserId: user.id, kind: 'password-reset', subject: `${brand.siteName}: reset your password`, error: link.error }, db)
  }
  const draft = passwordResetMail(brand, { url: link.url, expiresMinutes: RESET_LINK_TTL_MINUTES })
  return enqueueMail({ to: user.email, toUserId: user.id, kind: 'password-reset', ...draft }, db)
}

export async function queueInviteMail(invite: { name: string, email: string, roleLabel: string, expiresAt: Date }, inviter: string, token: string, db: Db = prisma): Promise<{ id: string }> {
  const brand = await loadBrand(db)
  const link = linkOrError(`/auth/accept-invite?token=${encodeURIComponent(token)}`)
  if ('error' in link) {
    return unsendable({ to: invite.email, toUserId: null, kind: 'staff-invite', subject: `${inviter} invited you to the ${brand.siteName} panel`, error: link.error }, db)
  }
  const draft = staffInviteMail(brand, { name: invite.name, role: invite.roleLabel, inviter, url: link.url, expiresAt: invite.expiresAt })
  return enqueueMail({ to: invite.email, toUserId: null, kind: 'staff-invite', ...draft }, db)
}
