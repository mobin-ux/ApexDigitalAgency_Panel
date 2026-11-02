import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { signEnquiry } from '../../shared/enquiry.ts'
import { BASE, client, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * Phase E of the Website group (ADR-026): enquiries. The site's signed
 * forward (refused unsigned, stale or tampered; idempotent on its id), the
 * contact form storing through the site when SITE_TEST_URL is set, the
 * workflow (owner, statuses, a lost reason, notes, the audit naming the
 * reference rather than the person), conversion into a client account with
 * its set-password email, and the 24-month retention.
 *
 * Local database only: it creates enquiries and customer accounts under
 * `@example.test` addresses, and back-dates rows through Prisma.
 */
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')
const run = Date.now().toString(36)

/** The dev pair's shared secret, from the panel's tracked dev `.env`. */
function devSecret(): string {
  const env = readFileSync(join(import.meta.dirname, '../../.env'), 'utf8')
  return /^NUXT_WEBSITE_ENQUIRY_SECRET=(.+)$/m.exec(env)?.[1]?.trim() ?? ''
}

async function forward(body: Record<string, unknown>, options: { secret?: string, timestamp?: number, tamper?: boolean } = {}) {
  const raw = JSON.stringify(body)
  const ts = String(options.timestamp ?? Math.floor(Date.now() / 1000))
  const signature = signEnquiry(options.secret ?? devSecret(), ts, raw)
  const res = await fetch(`${BASE}/api/site/enquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-apex-timestamp': ts, 'x-apex-signature': signature },
    body: options.tamper ? raw.replace('"name":"', '"name":"X') : raw,
  })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

function enquiry(name: string, email: string, extra: Record<string, unknown> = {}) {
  return { id: randomUUID(), name, email, phone: '', business: `${name} Ltd`, message: 'Hello', services: ['SEO'], plan: '', budget: '', reply: 'Email', source: '/contact', ...extra }
}

async function mailFor(to: string): Promise<{ kind: string, status: string, lastError: string | null, text: string }[]> {
  for (let i = 0; i < 20; i++) {
    const items = (await client().json<any>(`/api/_test/mail?to=${encodeURIComponent(to)}`)).body.items ?? []
    if (items.length && items.every((m: any) => m.status !== 'QUEUED' && m.status !== 'SENDING')) {
      return items
    }
    await new Promise(r => setTimeout(r, 150))
  }
  return (await client().json<any>(`/api/_test/mail?to=${encodeURIComponent(to)}`)).body.items ?? []
}

describe('website enquiries', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 300_000 }, () => {
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)
  let owner: Client
  let pm: Client
  let finance: Client
  let pmId: string

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    pm = await staffClient(owner, 'pm')
    finance = await staffClient(owner, 'finance')
    pmId = (await pm.json<any>('/api/auth/me')).body.user.id
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it('the site\'s forward is signed, fresh and stored once', async () => {
    assert.ok(devSecret(), 'the dev .env carries NUXT_WEBSITE_ENQUIRY_SECRET')
    const body = enquiry(`Signed ${run}`, `signed-${run}@example.test`)
    assert.equal((await fetch(`${BASE}/api/site/enquiries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, 401, 'unsigned')
    assert.equal((await forward(body, { secret: 'not-the-secret' })).status, 401, 'wrong secret')
    assert.equal((await forward(body, { tamper: true })).status, 401, 'body changed after signing')
    assert.equal((await forward(body, { timestamp: Math.floor(Date.now() / 1000) - 600 })).status, 401, 'ten minutes old')
    assert.equal((await forward({ ...body, email: 'not-an-email' })).status, 400)

    const first = await forward(body)
    assert.equal(first.status, 200, JSON.stringify(first.body))
    const again = await forward(body)
    assert.equal(again.status, 200)
    assert.equal(again.body.duplicate, true, 'a retried forward stores nothing new')
    assert.equal(await prisma.enquiry.count({ where: { email: body.email } }), 1)
  })

  it('the contact form stores through the site', { skip: !SITE && 'SITE_TEST_URL is not set' }, async () => {
    const email = `form-${run}@example.test`
    const res = await fetch(`${SITE}/api/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ name: `Form ${run}`, email, business: 'Form Bakery', message: 'Orders online, please.', services: ['website-design'], budget: '500-1k', reply: 'phone', source: '/contact?service=website-design' }),
    })
    assert.equal(res.status, 200, await res.text())
    const listed = await pm.json<any>(`/api/admin/website/enquiries?q=${encodeURIComponent(email)}`)
    const row = listed.body.items[0]
    assert.ok(row, 'the message is an enquiry in the console')
    const detail = (await pm.json<any>(`/api/admin/website/enquiries/${row.id}`)).body.enquiry
    assert.deepEqual(detail.services, ['Website Design'], 'the labels the visitor picked')
    assert.equal(detail.reply, 'Phone call')
    assert.equal(detail.source, '/contact?service=website-design')
  })

  it('is worked by the roles that handle enquiries, with a reason for lost', async () => {
    const body = enquiry(`Workflow ${run}`, `workflow-${run}@example.test`)
    const { id } = (await forward(body)).body
    assert.equal((await finance.json<any>(`/api/admin/website/enquiries/${id}`)).status, 403, 'finance does not handle enquiries')

    const summary = await pm.json<any>('/api/admin/website/enquiries/summary')
    assert.ok(summary.body.waiting.some((e: any) => e.id === id), 'new and uncontacted: in the Overview queue')
    assert.ok(summary.body.newCount >= 1)

    const list = await pm.json<any>('/api/admin/website/enquiries?filter=new&pageSize=100')
    assert.ok(list.body.items.some((e: any) => e.id === id))
    assert.ok(list.body.owners.some((o: any) => o.id === pmId), 'the PM can be given enquiries')
    assert.equal(list.body.canConvert, false, 'a PM cannot create client accounts')

    const customerId = (await prisma.user.findFirstOrThrow({ where: { role: 'CUSTOMER' } })).id
    assert.equal((await pm.json<any>(`/api/admin/website/enquiries/${id}`, { method: 'PATCH', json: { ownerId: customerId } })).status, 400, 'only staff who handle enquiries')
    const owned = await pm.json<any>(`/api/admin/website/enquiries/${id}`, { method: 'PATCH', json: { ownerId: pmId, status: 'contacted' } })
    assert.equal(owned.status, 200, JSON.stringify(owned.body))
    assert.equal(owned.body.enquiry.status, 'contacted')
    assert.equal(owned.body.enquiry.ownerId, pmId)

    assert.equal((await pm.json<any>(`/api/admin/website/enquiries/${id}`, { method: 'PATCH', json: { status: 'lost' } })).status, 400, 'lost needs a reason')
    const lost = await pm.json<any>(`/api/admin/website/enquiries/${id}`, { method: 'PATCH', json: { status: 'lost', lostReason: 'Went with a one-off build elsewhere' } })
    assert.equal(lost.body.enquiry.lostReason, 'Went with a one-off build elsewhere')
    const reopened = await pm.json<any>(`/api/admin/website/enquiries/${id}`, { method: 'PATCH', json: { status: 'qualified' } })
    assert.equal(reopened.body.enquiry.lostReason, null, 'reopening clears the reason')

    const noted = await pm.json<any>(`/api/admin/website/enquiries/${id}/notes`, { method: 'POST', json: { body: 'Called, left voicemail' } })
    assert.equal(noted.status, 200)
    assert.equal(noted.body.notes.at(-1).body, 'Called, left voicemail')
    assert.equal((await pm.json<any>(`/api/admin/website/enquiries/${id}/notes`, { method: 'POST', json: { body: '  ' } })).status, 400)

    // The audit log names the reference; the person's name, address and the note stay out of it.
    const rows = await prisma.auditLog.findMany({ where: { targetType: 'Enquiry', targetId: id } })
    assert.ok(rows.length >= 4, 'owner, status changes and the note are audited')
    const logged = JSON.stringify(rows)
    assert.ok(!logged.includes(body.name) && !logged.includes(body.email) && !logged.includes('voicemail'))
    assert.ok(rows.some(r => r.reason === 'Went with a one-off build elsewhere'), 'the lost reason is the audit reason')
  })

  it('converts to a client account that sets its own password', async () => {
    const email = `convert-${run}@example.test`
    const { id } = (await forward(enquiry(`Convert ${run}`, email, { business: `Convert ${run} Ltd`, phone: '01632 960002' }))).body
    const denied = await pm.json<any>(`/api/admin/website/enquiries/${id}/convert`, { method: 'POST' })
    assert.equal(denied.status, 403)
    assert.equal(denied.body.data.permission, 'clients.approve')

    const made = await owner.json<any>(`/api/admin/website/enquiries/${id}/convert`, { method: 'POST' })
    assert.equal(made.status, 200, JSON.stringify(made.body))
    assert.equal(made.body.enquiry.status, 'won')
    assert.equal(made.body.linked, false)
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { company: true } })
    assert.equal(user.role, 'CUSTOMER')
    assert.equal(user.company?.name, `Convert ${run} Ltd`)
    assert.equal(made.body.enquiry.client.id, user.id)

    assert.equal((await owner.json<any>(`/api/admin/website/enquiries/${id}/convert`, { method: 'POST' })).status, 409, 'once')
    assert.equal((await owner.json<any>(`/api/admin/website/enquiries/${id}`, { method: 'PATCH', json: { status: 'new' } })).status, 409, 'a client stays Won')

    // The welcome email carries a set-password link that works.
    const mail = (await mailFor(email)).find(m => m.kind === 'client-welcome')
    assert.ok(mail, 'a welcome email was queued')
    const token = /\/auth\/recover\?token=([\w-]+)/.exec(mail.text)?.[1]
    assert.ok(token, 'with a set-password link')
    const password = `Converted-${run}-pass!`
    assert.equal((await client().json<any>('/api/auth/reset-password-confirm', { method: 'POST', json: { token, newPassword: password } })).status, 200)
    const signedIn = await login(email, password)
    assert.equal((await signedIn.json<any>('/api/auth/me')).body.user.email, email)
  })

  it('links an address that is already a client, and refuses a staff address', async () => {
    const existing = await forward(enquiry(`Existing ${run}`, DEV_ACCOUNTS.customer.identifier))
    const linked = await owner.json<any>(`/api/admin/website/enquiries/${existing.body.id}/convert`, { method: 'POST' })
    assert.equal(linked.status, 200, JSON.stringify(linked.body))
    assert.equal(linked.body.linked, true)
    assert.equal(linked.body.mail, null, 'nothing emailed to an existing client')

    const staff = await forward(enquiry(`Staff ${run}`, DEV_ACCOUNTS.owner.identifier))
    assert.equal((await owner.json<any>(`/api/admin/website/enquiries/${staff.body.id}/convert`, { method: 'POST' })).status, 409)
  })

  it('deletes what did not become a client after 24 months', async () => {
    const old = (await forward(enquiry(`Old ${run}`, `old-${run}@example.test`))).body.id
    const young = (await forward(enquiry(`Young ${run}`, `young-${run}@example.test`))).body.id
    const kept = (await forward(enquiry(`Kept ${run}`, `kept-${run}@example.test`))).body.id
    assert.equal((await owner.json<any>(`/api/admin/website/enquiries/${kept}/convert`, { method: 'POST' })).status, 200)
    const longAgo = new Date()
    longAgo.setUTCMonth(longAgo.getUTCMonth() - 25)
    await prisma.enquiry.updateMany({ where: { id: { in: [old, kept] } }, data: { receivedAt: longAgo } })
    await prisma.enquiryNote.create({ data: { enquiryId: old, body: 'goes with it', authorId: pmId } })

    // Nitro's dev task runner (404 in production) runs the daily job now.
    const res = await fetch(`${BASE}/_nitro/tasks/website:enquiries-retention`)
    assert.equal(res.status, 200)
    assert.ok((await res.json() as any).result.deleted >= 1)
    assert.equal(await prisma.enquiry.count({ where: { id: old } }), 0, 'older than 24 months, not a client: deleted')
    assert.equal(await prisma.enquiryNote.count({ where: { enquiryId: old } }), 0, 'with its notes')
    assert.equal(await prisma.enquiry.count({ where: { id: kept } }), 1, 'became a client: kept')
    assert.equal(await prisma.enquiry.count({ where: { id: young } }), 1, 'recent: kept')
    const purge = await prisma.auditLog.findFirst({ where: { action: 'admin.website.enquiry.purge' }, orderBy: { createdAt: 'desc' } })
    assert.ok(purge && !purge.metadata?.includes(`old-${run}`), 'the purge is audited by count only')
  })
})
