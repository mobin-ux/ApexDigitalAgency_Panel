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
import { signVisits, visitDay } from '../../shared/visits.ts'
import { BASE, DEV_ACCOUNTS, enabled, login, staffClient } from './helpers.ts'

/**
 * Phase F of the Website group (ADR-026): the site's own cookieless visit
 * counts. The signed hand-over of a minute's totals (refused unsigned or
 * signed as an enquiry, counted once per batch id), the report the
 * Analytics screen and the Overview read, and, when SITE_TEST_URL is set,
 * a page's beacon on the site arriving here as totals.
 *
 * Local database only: it writes `SiteVisit` rows under `/analytics-test-*`
 * paths and deletes them at the end.
 */
const SITE = (process.env.SITE_TEST_URL ?? '').replace(/\/$/, '')
const run = Date.now().toString(36)
const PREFIX = `/analytics-test-${run}`
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

function devSecret(): string {
  const env = readFileSync(join(import.meta.dirname, '../../.env'), 'utf8')
  return /^NUXT_WEBSITE_ENQUIRY_SECRET=(.+)$/m.exec(env)?.[1]?.trim() ?? ''
}

async function send(batch: Record<string, unknown>, sign: 'visits' | 'enquiry' | 'none' = 'visits') {
  const raw = JSON.stringify(batch)
  const ts = String(Math.floor(Date.now() / 1000))
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-apex-timestamp': ts }
  if (sign !== 'none') {
    headers['x-apex-signature'] = (sign === 'visits' ? signVisits : signEnquiry)(devSecret(), ts, raw)
  }
  const res = await fetch(`${BASE}/api/site/visits`, { method: 'POST', headers, body: raw })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

describe('website analytics', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 180_000 }, () => {
  const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined)
  let owner: Client
  let finance: Client
  let support: Client
  const today = visitDay()

  before(async () => {
    owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    finance = await staffClient(owner, 'finance')
    support = await staffClient(owner, 'support')
  })

  after(async () => {
    await prisma.siteVisit.deleteMany({ where: { path: { startsWith: PREFIX } } })
    await prisma.$disconnect()
  })

  it('takes a minute\'s totals only when signed for visits, and counts a batch once', async () => {
    const batch = { id: randomUUID(), buckets: [
      { day: today, path: `${PREFIX}/a`, source: 'Google search', views: 3, visits: 2 },
      { day: today, path: `${PREFIX}/a`, source: '', views: 4, visits: 0 },
    ] }
    assert.equal((await send(batch, 'none')).status, 401, 'unsigned')
    assert.equal((await send(batch, 'enquiry')).status, 401, 'an enquiry signature is not a visits signature')
    assert.equal((await send({ id: randomUUID(), buckets: [{ day: today, path: 'no-slash', source: '', views: 1, visits: 0 }] })).status, 400)

    const first = await send(batch)
    assert.equal(first.status, 200)
    assert.equal(first.body.counted, 2)
    const again = await send(batch)
    assert.equal(again.status, 200)
    assert.equal(again.body.duplicate, true, 'a retried batch is not counted twice')

    await send({ id: randomUUID(), buckets: [{ day: today, path: `${PREFIX}/a`, source: 'Google search', views: 1, visits: 1 }] })
    const row = await prisma.siteVisit.findUniqueOrThrow({ where: { day_path_source: { day: today, path: `${PREFIX}/a`, source: 'Google search' } } })
    assert.deepEqual([row.views, row.visits], [4, 3], 'a later batch adds to the day')
  })

  it('reports totals by period to the roles holding analytics.view', async () => {
    assert.equal((await support.json('/api/admin/website/analytics')).status, 403, 'Support does not see analytics')
    const res = await finance.json<any>('/api/admin/website/analytics')
    assert.equal(res.status, 200, 'Finance does')
    const r = res.body
    assert.equal(r.days, 30)
    assert.equal(r.series.length, 30)
    assert.equal(r.to, today)
    assert.ok(r.firstDay && r.firstDay <= today)
    const last = r.series.at(-1)
    assert.equal(last.day, today)
    assert.equal(last.counted, true)
    assert.ok(last.visits >= 3 && last.views >= 8)
    assert.ok(r.sources.some((s: any) => s.source === 'Google search' && s.visits >= 3))
    assert.equal(typeof r.enquiries.received, 'number')
    assert.equal(typeof r.orders, 'number')
    assert.ok(!JSON.stringify(r).includes('@'), 'no addresses in the report')

    assert.equal((await owner.json<any>('/api/admin/website/analytics?days=7')).body.series.length, 7)
    assert.equal((await owner.json<any>('/api/admin/website/analytics?days=14')).body.series.length, 14)
    assert.equal((await owner.json<any>('/api/admin/website/analytics?days=365')).body.days, 30, 'an unknown period is 30 days')
  })

  it('a page on the site counts itself and the totals arrive here', { skip: !SITE && 'SITE_TEST_URL is not set' }, async () => {
    const hit = (body: unknown, headers: Record<string, string> = {}) => fetch(`${SITE}/api/hit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'user-agent': BROWSER, ...headers },
      body: JSON.stringify(body),
    })
    // From a search engine, then a page reached from the first.
    assert.equal((await hit({ p: `${PREFIX}/b?q=private`, e: 1, r: 'www.bing.com', u: '' })).status, 204)
    await hit({ p: `${PREFIX}/c` })
    // A tagged link, and a reload of a page reached from the site itself.
    await hit({ p: `${PREFIX}/c`, e: 1, r: '', u: 'gbp' })
    await hit({ p: `${PREFIX}/c`, e: 1, r: new URL(SITE).hostname })
    // Not counted: a bot, a cross-site beacon, something that is not a page.
    assert.equal((await hit({ p: `${PREFIX}/c`, e: 1 }, { 'user-agent': 'Googlebot/2.1' })).status, 204)
    await hit({ p: `${PREFIX}/c`, e: 1 }, { 'sec-fetch-site': 'cross-site' })
    await hit({ p: '/api/contact', e: 1 })

    assert.equal((await fetch(`${SITE}/_nitro/tasks/visits:flush`)).status, 200)
    let rows: { path: string, source: string, views: number, visits: number }[] = []
    for (let i = 0; i < 20 && rows.length < 3; i++) {
      rows = await prisma.siteVisit.findMany({ where: { day: today, path: { in: [`${PREFIX}/b`, `${PREFIX}/c`] } }, select: { path: true, source: true, views: true, visits: true } })
      await new Promise(r => setTimeout(r, 250))
    }
    const at = (path: string, source: string) => rows.find(r => r.path === `${PREFIX}${path}` && r.source === source)
    assert.deepEqual(at('/b', 'Bing') && [at('/b', 'Bing')!.views, at('/b', 'Bing')!.visits], [1, 1], 'the query is dropped; Bing is the source')
    assert.deepEqual(at('/c', '') && [at('/c', '')!.views, at('/c', '')!.visits], [2, 0], 'reached from the site: views, not visits')
    assert.deepEqual(at('/c', 'Google Business Profile') && [at('/c', 'Google Business Profile')!.views, at('/c', 'Google Business Profile')!.visits], [1, 1])
    assert.equal(rows.length, 3, 'the bot and the cross-site beacon counted nothing')
  })
})
