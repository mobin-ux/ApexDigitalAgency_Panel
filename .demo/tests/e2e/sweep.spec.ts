import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { BASE } from '../api/helpers.ts'
import { customerClient, hydrated, ownerClient, useSession } from './support.ts'

/**
 * A sweep of every screen, as a person would open them: each customer page
 * (and its deep-linked states) as the dev customer, and each console screen
 * and a record of each kind as the owner. For every one it keeps what went
 * wrong: the page's own status, uncaught errors, console errors, and every
 * request that came back 4xx or 5xx with its address and the request id the
 * server gave it, so the line in the platform log can be found.
 *
 * It fails only on a server error or a page that never renders; everything
 * else is written to `.demo/.data/e2e-sweep.json` for the issue register.
 */

interface Finding { screen: string, kind: 'status' | 'pageerror' | 'console' | 'request' | 'render', detail: string, requestId?: string }

const REPORT = path.join(import.meta.dirname, '../../.data/e2e-sweep.json')
const findings: Finding[] = []
const timings: { screen: string, ms: number }[] = []
const DEV_NOISE = [/WebSocket connection/, /Transition was (aborted|skipped)/, /\[vite\]/, /Download the Vue Devtools/, /\[Vue Router warn\]/]

function watch(page: Page, screen: () => string) {
  page.on('pageerror', e => findings.push({ screen: screen(), kind: 'pageerror', detail: e.message.slice(0, 300) }))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !DEV_NOISE.some(re => re.test(msg.text()))) {
      findings.push({ screen: screen(), kind: 'console', detail: msg.text().slice(0, 300) })
    }
  })
  page.on('response', async (res) => {
    const url = res.url()
    if (res.status() >= 400 && url.startsWith(BASE) && !/\/_nuxt\/|__nuxt_|\/api\/_nuxt_icon/.test(url)) {
      findings.push({ screen: screen(), kind: 'request', detail: `${res.request().method()} ${url.replace(BASE, '')} → ${res.status()}`, requestId: res.headers()['x-request-id'] })
    }
  })
}

async function visit(page: Page, screen: string, current: { value: string }) {
  current.value = screen
  const started = Date.now()
  const res = await page.goto(screen, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  const status = res?.status() ?? 0
  if (status >= 400) {
    findings.push({ screen, kind: 'status', detail: `page answered ${status}`, requestId: res?.headers()['x-request-id'] })
  }
  try {
    await hydrated(page)
  }
  catch {
    findings.push({ screen, kind: 'render', detail: 'did not hydrate within the timeout' })
  }
  timings.push({ screen, ms: Date.now() - started })
  const h1 = await page.locator('h1').count()
  if (h1 === 0) {
    findings.push({ screen, kind: 'render', detail: 'no h1 on the page' })
  }
  expect(status, `${screen} must not be a server error`).toBeLessThan(500)
}

test.afterAll(() => {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), base: BASE, findings, timings }, null, 2))
})

test('every customer page and its deep links', async ({ page, context }) => {
  test.setTimeout(15 * 60_000)
  const customer = await customerClient()
  await useSession(context, customer)
  const current = { value: '' }
  watch(page, () => current.value)
  const orders = (await customer.json<any>('/api/orders')).body
  const projectId = orders.data?.[0]?.id
  const tickets = (await customer.json<any>('/api/support/tickets')).body
  const ticketId = (tickets.tickets ?? tickets.data ?? tickets)?.[0]?.id
  const screens = [
    '/dashboards/balance',
    '/dashboards/services',
    '/dashboards/services?service=web',
    '/dashboards/orders',
    ...(projectId ? [`/dashboards/orders?project=${projectId}`] : []),
    '/dashboards/wallet',
    '/dashboards/wallet?credit=apply',
    '/dashboards/wallet?credit=status',
    '/dashboards/support',
    '/dashboards/support?tab=new',
    ...(ticketId ? [`/dashboards/support?ticket=${ticketId}`] : []),
    '/dashboards/settings',
    '/dashboards/settings?section=company',
    '/dashboards/settings?section=security',
    '/dashboards/settings?section=billing',
    '/legal/terms',
    '/legal/privacy',
  ]
  for (const screen of screens) {
    await visit(page, screen, current)
  }
})

test('every console screen and a record of each kind', async ({ page, context }) => {
  test.setTimeout(20 * 60_000)
  const owner = await ownerClient()
  await useSession(context, owner)
  const current = { value: '' }
  watch(page, () => current.value)
  const first = async (url: string, pick: (b: any) => any) => {
    try {
      return pick((await owner.json<any>(url)).body)
    }
    catch {
      return undefined
    }
  }
  const project = await first('/api/admin/projects?pageSize=1', b => b.items?.[0]?.id)
  const user = await first('/api/admin/users?pageSize=1', b => b.items?.[0]?.id)
  const contract = await first('/api/admin/contracts?pageSize=1', b => b.items?.[0]?.id)
  const insight = await first('/api/admin/website/documents?collection=insights&pageSize=1', b => b.items?.[0]?.id)
  const study = await first('/api/admin/website/documents?collection=work&pageSize=1', b => b.items?.[0]?.id)
  const screens = [
    '/admin',
    '/admin/projects',
    ...(project ? [`/admin/projects/${project}`] : []),
    '/admin/tickets',
    '/admin/services',
    '/admin/users',
    ...(user ? [`/admin/users/${user}`] : []),
    '/admin/team',
    '/admin/payments',
    '/admin/credit',
    '/admin/contracts',
    ...(contract ? [`/admin/contracts/${contract}`] : []),
    '/admin/website/pages',
    '/admin/website/insights',
    ...(insight ? [`/admin/website/insights/${insight}`] : []),
    '/admin/website/case-studies',
    ...(study ? [`/admin/website/case-studies/${study}`] : []),
    '/admin/website/media',
    '/admin/website/navigation',
    '/admin/website/seo',
    '/admin/website/enquiries',
    '/admin/website/analytics',
    '/admin/site-settings',
    '/admin/settings',
    '/admin/audit',
    '/admin/mail',
    '/admin/logs',
    '/admin/tools',
  ]
  for (const screen of screens) {
    await visit(page, screen, current)
  }
})
