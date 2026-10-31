import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
import process from 'node:process'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { after, before, describe, it } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * Data hardening (ADR-025, phase 3): lists sort on the server over a
 * whitelist, a role sees only the personal and money fields it holds the
 * permission for, and the audit log refuses to be rewritten — by the
 * database, not only by the absence of a route.
 */
function sorted<T>(values: T[], dir: 'asc' | 'desc'): boolean {
  return values.every((v, i) => i === 0 || (dir === 'asc' ? values[i - 1]! <= v : values[i - 1]! >= v))
}

describe('admin data hardening', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  let owner: Client
  let support: Client
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    support = await staffClient(owner, 'support')
  })

  after(async () => {
    await prisma.$disconnect()
  })

  it('lists sort on the server, in both directions, over the whole table', async () => {
    const asc = await owner.json<any>('/api/admin/projects?sort=name&dir=asc&pageSize=100')
    assert.equal(asc.status, 200)
    assert.ok(sorted(asc.body.items.map((p: any) => p.name), 'asc'), 'projects by name A–Z')
    const desc = await owner.json<any>('/api/admin/projects?sort=name&dir=desc&pageSize=100')
    assert.ok(sorted(desc.body.items.map((p: any) => p.name), 'desc'), 'projects by name Z–A')

    const money = await owner.json<any>('/api/admin/finance/transactions?sort=amount&dir=desc&pageSize=100')
    assert.equal(money.status, 200)
    assert.ok(sorted(money.body.items.map((t: any) => t.amount), 'desc'), 'transactions by amount')

    const clients = await owner.json<any>('/api/admin/users?sort=name&dir=asc&pageSize=100')
    assert.ok(sorted(clients.body.items.map((u: any) => u.firstName ?? ''), 'asc'), 'clients by first name')

    for (const path of ['/api/admin/tickets?sort=created&dir=asc', '/api/admin/contracts?sort=signed', '/api/admin/audit?dir=asc']) {
      assert.equal((await owner.json(path)).status, 200, path)
    }
  })

  it('pages under a sort neither repeat nor skip a row', async () => {
    const all = await owner.json<any>('/api/admin/finance/transactions?sort=amount&dir=asc&pageSize=100')
    const first = await owner.json<any>('/api/admin/finance/transactions?sort=amount&dir=asc&pageSize=5&page=1')
    const second = await owner.json<any>('/api/admin/finance/transactions?sort=amount&dir=asc&pageSize=5&page=2')
    const paged = [...first.body.items, ...second.body.items].map((t: any) => t.id)
    assert.deepEqual(paged, all.body.items.slice(0, paged.length).map((t: any) => t.id))
    assert.equal(new Set(paged).size, paged.length)
  })

  it('an unknown sort column is a 400, never a field name passed through', async () => {
    for (const path of ['/api/admin/projects?sort=password', '/api/admin/users?sort=walletBalance', '/api/admin/finance/transactions?dir=sideways']) {
      assert.equal((await owner.json(path)).status, 400, path)
    }
  })

  it('a role without money.view can neither see nor sort by a value', async () => {
    const res = await support.json<any>('/api/admin/projects?sort=value&dir=desc&pageSize=100')
    assert.equal(res.status, 200)
    assert.ok(res.body.items.every((p: any) => p.amount === null), 'values are not sent')
    const fallback = await support.json<any>('/api/admin/projects?pageSize=100')
    assert.deepEqual(res.body.items.map((p: any) => p.id), fallback.body.items.map((p: any) => p.id), 'the value order is ignored, the default order used')
  })

  it('the client list carries only what its rows show', async () => {
    const res = await owner.json<any>('/api/admin/users?pageSize=100')
    assert.equal(res.status, 200)
    for (const u of res.body.items) {
      for (const field of ['walletBalance', 'adCredits', 'city', 'country', 'verifiedAt', 'password']) {
        assert.equal(field in u, false, `${field} is not in the list`)
      }
      if (u.email) {
        assert.equal(u.phone, null, 'the phone is only sent for an account with no email')
      }
    }
  })

  it('a client record leaves out money and personal details for roles without them', async () => {
    const list = await owner.json<any>('/api/admin/users?role=CUSTOMER&pageSize=1')
    const id = list.body.items[0].id
    const full = await owner.json<any>(`/api/admin/users/${id}`)
    assert.equal(typeof full.body.walletBalance, 'number')
    assert.equal(full.body.canMoney, true)
    assert.ok('birthDate' in full.body)

    const narrow = await support.json<any>(`/api/admin/users/${id}`)
    assert.equal(narrow.status, 200)
    assert.equal(narrow.body.walletBalance, null)
    assert.equal(narrow.body.adCredits, null)
    assert.deepEqual(narrow.body.transactions, [])
    assert.ok(narrow.body.projects.every((p: any) => p.amount === null))
    assert.equal('birthDate' in narrow.body, false)
    assert.equal('gender' in narrow.body, false)
    assert.equal(narrow.body.canMoney, false)
  })

  it('the database refuses to change or delete an audit entry', async () => {
    const row = await prisma.auditLog.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })
    const count = await prisma.auditLog.count()
    // Prisma reports SQLite's trigger abort as a constraint failure, so the
    // proof is the refusal plus the row and the count being unchanged.
    await assert.rejects(prisma.auditLog.update({ where: { id: row.id }, data: { action: 'rewritten' } }))
    await assert.rejects(prisma.auditLog.delete({ where: { id: row.id } }))
    await assert.rejects(prisma.auditLog.deleteMany({}))
    const still = await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })
    assert.equal(still.action, row.action)
    assert.equal(await prisma.auditLog.count(), count)
  })
})
