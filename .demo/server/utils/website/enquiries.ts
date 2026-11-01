import type { EnquiryFilter, EnquiryStatus } from '../../../shared/enquiry-status'
import type { Db } from '../mail/outbox'
import { z } from 'zod'
import { enquiryRetentionCutoff } from '../../../shared/enquiry-status'
import { enquiryRef } from '../../../shared/refs'
import prisma from '../prisma'
import { namesOf } from './content'

/**
 * Enquiries from the website's contact form (ADR-026, phase E): what the
 * site forwards, how a row is shown, and the 24-month retention. The routes
 * under `/api/admin/website/enquiries/**` and the public
 * `POST /api/site/enquiries` are thin over this.
 */

/** The body the site sends, checked again here: the signature proves who sent it, not that it is well formed. */
export const forwardedEnquirySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).default(''),
  business: z.string().trim().max(200).default(''),
  message: z.string().trim().max(5000).default(''),
  services: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  plan: z.string().trim().max(120).default(''),
  budget: z.string().trim().max(60).default(''),
  reply: z.string().trim().max(40).default(''),
  source: z.string().max(300).default(''),
})

export type EnquiryRow = Awaited<ReturnType<typeof prisma.enquiry.findFirstOrThrow>>

export function filterWhere(filter: EnquiryFilter) {
  return filter === 'open' ? { status: { notIn: ['won', 'lost'] } } : { status: filter }
}

export function servicesOf(row: Pick<EnquiryRow, 'services'>): string[] {
  try {
    const parsed = JSON.parse(row.services)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  }
  catch {
    return []
  }
}

/** The design's "· Website design" after the business: what they asked about, in one phrase. */
export function topicOf(row: Pick<EnquiryRow, 'services' | 'plan'>): string {
  if (row.plan) {
    return row.plan
  }
  const services = servicesOf(row)
  return services.length ? services.join(', ') : 'General enquiry'
}

/** One row of the list, the overview and the palette. */
export function enquirySummary(row: EnquiryRow, names: Map<string, string>) {
  return {
    id: row.id,
    ref: enquiryRef(row.id),
    name: row.name,
    business: row.business,
    topic: topicOf(row),
    status: row.status as EnquiryStatus,
    owner: row.ownerId ? names.get(row.ownerId) ?? 'Staff' : null,
    ownerId: row.ownerId,
    receivedAt: row.receivedAt.toISOString(),
  }
}

export async function summariseAll(rows: EnquiryRow[], db: Db = prisma) {
  const names = await namesOf(rows.map(r => r.ownerId), db)
  return rows.map(r => enquirySummary(r, names))
}

/**
 * Deletes what did not become a client within the retention period, with
 * its staff notes. Returns how many went. The audit entry carries the count
 * only: an append-only log must not keep the personal data the deletion is
 * there to remove.
 */
export async function purgeExpiredEnquiries(now = new Date()): Promise<number> {
  const cutoff = enquiryRetentionCutoff(now)
  const { count } = await prisma.enquiry.deleteMany({ where: { clientId: null, receivedAt: { lt: cutoff } } })
  if (count) {
    await prisma.auditLog.create({
      data: {
        actorId: 'system',
        actorEmail: 'system',
        action: 'admin.website.enquiry.purge',
        targetType: 'Enquiry',
        metadata: JSON.stringify({ subject: `${count} ${count === 1 ? 'enquiry' : 'enquiries'} older than 24 months`, deleted: count, before: cutoff.toISOString() }),
      },
    })
  }
  return count
}

/** The detail panel: everything the visitor sent, the outcome, and the staff notes oldest first. */
export async function enquiryDetail(id: string, db: Db = prisma) {
  const row = await db.enquiry.findUnique({ where: { id }, include: { notes: { orderBy: { createdAt: 'asc' } } } })
  if (!row) {
    return null
  }
  const names = await namesOf([row.ownerId, row.convertedById, ...row.notes.map(n => n.authorId)], db)
  const client = row.clientId ? await db.user.findUnique({ where: { id: row.clientId }, select: { id: true, firstName: true, lastName: true, email: true } }) : null
  return {
    enquiry: {
      ...enquirySummary(row, names),
      email: row.email,
      phone: row.phone,
      message: row.message,
      services: servicesOf(row),
      plan: row.plan,
      budget: row.budget,
      reply: row.reply,
      source: row.source,
      lostReason: row.lostReason,
      // A client account deleted since leaves `converted` true and `client` null.
      client: client ? { id: client.id, name: [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email || 'Client' } : null,
      converted: Boolean(row.clientId),
      convertedAt: row.convertedAt?.toISOString() ?? null,
      convertedBy: row.convertedById ? names.get(row.convertedById) ?? 'Staff' : null,
    },
    notes: row.notes.map(n => ({ id: n.id, body: n.body, author: names.get(n.authorId) ?? 'Staff', role: n.authorRole, createdAt: n.createdAt.toISOString() })),
  }
}
