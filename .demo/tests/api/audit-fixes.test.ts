import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { BASE, client, DEV_ACCOUNTS, enabled, login, staffClient, staffEmailFor } from './helpers.ts'

/**
 * The Medium issues of docs/audit/ISSUES-2026-11-02.md, checked through the
 * real endpoints once fixed: the template's demo endpoint is gone (AUD-04),
 * progress follows the milestone timeline whoever writes it (AUD-05), an
 * error carries its own status text (AUD-06), the site lets a console origin
 * named at run time frame its previews (AUD-09), and ended sessions are
 * pruned (AUD-10). Back-dating a session is the one write no route can do,
 * so this suite makes it in the local database.
 */
const DAY = 86_400_000
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')

describe('audit fixes (Medium)', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let customer: Client
  let customerId = ''
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    const stamp = Date.now().toString(36)
    const signup = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: `audit-${stamp}@example.test`, password: `Audit-${stamp}-pass`, name: 'Audit Tester' } })
    assert.equal(signup.status, 200, await signup.clone().text())
    customer = client(signup.headers.getSetCookie().map(c => c.split(';')[0]).join('; '))
    customerId = (await customer.json<any>('/api/auth/me')).body.user.id
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it('the template\'s demo messaging endpoint is gone (AUD-04)', async () => {
    assert.equal((await client().fetch('/api/messaging')).status, 404)
  })

  it('an error says what its status is, not "Server Error" (AUD-06)', async () => {
    const cases: [string, number, string][] = [
      ['/api/auth/invite?token=nope', 400, 'Bad Request'],
      ['/api/orders', 401, 'Unauthorized'],
    ]
    for (const [path, status, text] of cases) {
      const res = await client().fetch(path)
      assert.equal(res.status, status, path)
      assert.equal(res.statusText, text, `${path} status line`)
      assert.equal((await res.json() as any).statusMessage, text, `${path} body`)
    }
  })

  it('kickoff sets progress from the timeline, and a typed figure cannot contradict it (AUD-05)', async () => {
    const order = await customer.json<any>('/api/orders', {
      method: 'POST',
      json: { title: `Audit ${Date.now().toString(36)}`, serviceId: 'web', planId: 'starter', pay: 'monthly', signature: 'Audit Tester', signatureType: 'typed', signerName: 'Audit Tester' },
    })
    assert.equal(order.status, 200, JSON.stringify(order.body).slice(0, 400))
    const projectId = order.body.project?.id ?? order.body.id
    const pending = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
    const topup = await customer.json<any>('/api/finance/topup', { method: 'POST', json: { amount: Math.ceil(pending.kickoffAmount) + 1 } })
    assert.equal(topup.status, 200, JSON.stringify(topup.body).slice(0, 300))
    const kickoff = await owner.json<any>(`/api/admin/projects/${projectId}/kickoff`, { method: 'POST' })
    assert.equal(kickoff.status, 200, JSON.stringify(kickoff.body).slice(0, 300))

    const started = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { milestones: true } })
    assert.ok(started.milestones.length > 1, 'the order has a timeline')
    const share = Math.round(started.milestones.filter(m => m.status === 'COMPLETED').length / started.milestones.length * 100)
    assert.equal(started.progress, share, `progress ${started.progress}% is the timeline's ${share}%`)

    const typed = await owner.json<any>(`/api/admin/projects/${projectId}`, { method: 'PATCH', json: { progress: 80 } })
    assert.equal(typed.status, 409, 'a hand-typed progress on a project with a timeline')
    const same = await owner.json<any>(`/api/admin/projects/${projectId}`, { method: 'PATCH', json: { progress: share, name: started.name } })
    assert.equal(same.status, 200, 'saving the form with the progress unchanged still works')
  })

  it('sessions that ended over 30 days ago are pruned, recent ones kept (AUD-10)', async () => {
    const long = new Date(Date.now() - 40 * DAY)
    const [expired, revoked, recent] = await Promise.all([
      prisma.session.create({ data: { userId: customerId, expiresAt: long } }),
      prisma.session.create({ data: { userId: customerId, expiresAt: new Date(Date.now() + DAY), revokedAt: long } }),
      prisma.session.create({ data: { userId: customerId, expiresAt: new Date(Date.now() - 2 * DAY) } }),
    ])
    // Nitro's dev task runner (404 in production) runs the daily job now.
    const res = await fetch(`${BASE}/_nitro/tasks/sessions:prune`)
    assert.equal(res.status, 200)
    assert.ok((await res.json() as any).result.deleted >= 2)
    assert.equal(await prisma.session.count({ where: { id: { in: [expired.id, revoked.id] } } }), 0, 'ended 40 days ago: deleted')
    assert.equal(await prisma.session.count({ where: { id: recent.id } }), 1, 'ended two days ago: kept')
    await prisma.session.delete({ where: { id: recent.id } })
  })

  it('the site lets the console named at run time frame a preview (AUD-09)', { skip: !SITE && 'SITE_TEST_URL is not set' }, async () => {
    // A real draft's preview: an unknown token is the site's 404 page, which keeps `frame-ancestors 'none'`.
    const created = await owner.json<any>('/api/admin/website/documents', { method: 'POST', json: { template: 'built-page', title: 'Frame check', path: `/frame-check-${Date.now().toString(36)}` } })
    assert.equal(created.status, 200, JSON.stringify(created.body).slice(0, 300))
    const preview = await owner.json<any>(`/api/admin/website/documents/${created.body.document.id}/preview`, { method: 'POST', json: {} })
    assert.equal(preview.status, 200)
    const res = await fetch(`${SITE}/preview/${preview.body.token}`, { headers: { accept: 'text/html' } })
    assert.equal(res.status, 200)
    const csp = res.headers.get('content-security-policy') ?? ''
    assert.match(csp, new RegExp(`frame-ancestors[^;]*${new URL(BASE).origin.replace(/[.:/]/g, '\\$&')}`), csp)
  })
})

/**
 * The Low issues: a photo whose file is gone stops being asked for (AUD-11),
 * the dev seeds sign in like every other route (AUD-15), and a staff account
 * with no role is marked on Team & access (AUD-17). The photo row and the
 * role-less account are set up in the local database, which no route can do.
 */
describe('audit fixes (Low)', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let customer: Client
  let customerId = ''
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    const stamp = Date.now().toString(36)
    const signup = await client().fetch('/api/auth/signup', { method: 'POST', json: { identifier: `audit-low-${stamp}@example.test`, password: `Audit-${stamp}-pass`, name: 'Audit Low' } })
    assert.equal(signup.status, 200, await signup.clone().text())
    customer = client(signup.headers.getSetCookie().map(c => c.split(';')[0]).join('; '))
    customerId = (await customer.json<any>('/api/auth/me')).body.user.id
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it('a profile photo whose file is gone goes back to initials (AUD-11)', async () => {
    const file = await prisma.attachment.create({ data: { name: 'me.png', path: '00000000-0000-4000-8000-000000000000', size: 10, mime: 'image/png', uploaderId: customerId, avatarUserId: customerId } })
    const url = `/api/avatars/${customerId}?v=${file.id.slice(0, 8)}`
    await prisma.user.update({ where: { id: customerId }, data: { avatar: url } })
    assert.equal((await customer.fetch(url)).status, 404)
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: customerId } })).avatar, null, 'the account has no photo now')
    assert.equal((await prisma.attachment.findUniqueOrThrow({ where: { id: file.id } })).avatarUserId, null, 'the row is no longer the photo')
    assert.equal((await customer.json<any>('/api/auth/me')).body.user.avatar ?? null, null)
  })

  it('the dev seeds run for the signed-in account (AUD-15)', async () => {
    for (const seed of ['seed-notifs', 'seed-orders', 'seed-rich', 'seed-support', 'seed-wallet']) {
      const res = await customer.fetch(`/api/${seed}`)
      assert.equal(res.status, 200, `${seed}: ${(await res.text()).slice(0, 200)}`)
    }
    assert.equal((await client().fetch('/api/seed-orders')).status, 401, 'signed out')
    const projects = await prisma.project.findMany({ where: { userId: customerId }, include: { milestones: true } })
    assert.ok(projects.length > 0)
    for (const p of projects.filter(p => p.milestones.length)) {
      const share = Math.round(p.milestones.filter(m => m.status === 'COMPLETED').length / p.milestones.length * 100)
      assert.equal(p.progress, share, `${p.name}: seeded progress follows its timeline`)
    }
  })

  it('a staff account with no role is marked on Team & access (AUD-17)', async () => {
    await staffClient(owner, 'readonly')
    const email = staffEmailFor('readonly')
    await prisma.user.update({ where: { email }, data: { staffRole: null } })
    try {
      const team = await owner.json<any>('/api/admin/team')
      const member = team.body.members.find((m: any) => m.email === email)
      assert.equal(member.roleUnset, true)
      assert.equal(member.staffRole, 'owner', 'the documented fallback still applies')
      assert.ok(team.body.members.filter((m: any) => m.email !== email).every((m: any) => typeof m.roleUnset === 'boolean'))
    }
    finally {
      await prisma.user.update({ where: { email }, data: { staffRole: 'readonly' } })
    }
  })
})
