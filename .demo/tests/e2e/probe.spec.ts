import type { BrowserContext, Page } from '@playwright/test'
import type { Client } from '../api/helpers.ts'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { test } from '@playwright/test'
import { BASE } from '../api/helpers.ts'
import { customerClient, hydrated, ownerClient, useSession } from './support.ts'

/**
 * Speed and looks, screen by screen (run on demand, not in the smoke set):
 *
 *   E2E_URL=http://localhost:3020 PROBE=1 pnpm e2e probe
 *
 * Point it at a production build (`node .demo/.output/server/index.mjs`):
 * a dev server compiles on first visit and its numbers mean nothing.
 *
 * For each customer page and console screen it records, at 1440px in light:
 * time to first byte, DOM ready, load, hydration, largest paint, layout
 * shift, long tasks, bytes by kind, and every API call with its time. Then,
 * at 1440px and 390px in light and dark, what looks wrong: sideways scroll
 * and the elements causing it, images that did not load, text under 4.5:1
 * against its surface (3:1 from 24px, or 18.66px bold), fonts that failed,
 * and hydration warnings. Everything goes to `.demo/.data/e2e-probe.json`.
 */

test.skip(!process.env.PROBE, 'set PROBE=1 to run the speed and looks probe')

const REPORT = path.join(import.meta.dirname, '../../.data/e2e-probe.json')
const report: { perf: unknown[], visual: unknown[] } = { perf: [], visual: [] }

const VIEWS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const
const THEMES = ['light', 'dark'] as const

// Collected from the first paint: largest paint, layout shift, long tasks,
// and when the Vue app appeared on the root.
function instrument(context: BrowserContext, theme: string) {
  return context.addInitScript((mode: string) => {
    try {
      localStorage.setItem('nuxt-color-mode', mode)
    }
    catch {}
    const w = window as any
    w.__probe = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0, hydratedAt: 0 }
    try {
      new PerformanceObserver(list => list.getEntries().forEach((e) => {
        w.__probe.lcp = e.startTime
      })).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver(list => list.getEntries().forEach((e: any) => {
        if (!e.hadRecentInput) {
          w.__probe.cls += e.value
        }
      })).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver(list => list.getEntries().forEach((e) => {
        w.__probe.longTasks += 1
        w.__probe.longTaskMs += e.duration
      })).observe({ type: 'longtask', buffered: true })
    }
    catch {}
    const timer = setInterval(() => {
      if ((document.querySelector('#__nuxt') as any)?.__vue_app__) {
        w.__probe.hydratedAt = performance.now()
        clearInterval(timer)
      }
    }, 10)
  }, theme)
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const kinds: Record<string, { count: number, bytes: number }> = {}
    for (const r of resources) {
      const url = new URL(r.name)
      const kind = url.pathname.startsWith('/api/')
        ? 'api'
        : /\.m?js$/.test(url.pathname) ? 'js' : /\.css$/.test(url.pathname) ? 'css' : /\.(?:woff2?|ttf)$/.test(url.pathname) ? 'font' : r.initiatorType === 'img' || /\.(?:png|jpe?g|webp|svg|gif)$/.test(url.pathname) ? 'img' : 'other'
      kinds[kind] ??= { count: 0, bytes: 0 }
      kinds[kind].count += 1
      kinds[kind].bytes += r.encodedBodySize
    }
    const probe = (window as any).__probe
    return {
      ttfb: Math.round(nav.responseStart),
      domReady: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd),
      hydrated: Math.round(probe.hydratedAt),
      lcp: Math.round(probe.lcp),
      cls: Number(probe.cls.toFixed(3)),
      longTasks: probe.longTasks,
      longTaskMs: Math.round(probe.longTaskMs),
      htmlBytes: nav.encodedBodySize,
      domNodes: document.getElementsByTagName('*').length,
      kinds,
      api: resources.filter(r => new URL(r.name).pathname.startsWith('/api/')).map(r => `${Math.round(r.duration)}ms ${new URL(r.name).pathname}${new URL(r.name).search}`),
    }
  })
}

// Runs in the page: what looks wrong on this screen as rendered.
async function inspect(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    function rgba(css: string): [number, number, number, number] {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
    }
    function over(top: [number, number, number, number], under: [number, number, number]): [number, number, number] {
      const a = top[3]
      return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a)]
    }
    function luminance([r, g, b]: [number, number, number]) {
      const c = [r, g, b].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
    }
    // The surface under an element, or null when an image or gradient is in the way.
    function surface(el: Element | null): [number, number, number] | null {
      const layers: [number, number, number, number][] = []
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.backgroundImage !== 'none') {
          return null
        }
        const bg = rgba(style.backgroundColor)
        if (bg[3] > 0) {
          layers.push([bg[0], bg[1], bg[2], bg[3] * Number(style.opacity || 1)])
          if (bg[3] >= 1) {
            break
          }
        }
      }
      let base: [number, number, number] = [255, 255, 255]
      for (const layer of layers.reverse()) {
        base = over(layer, base)
      }
      return base
    }
    function describe(el: Element) {
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 4).join('.') : ''
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0.05
    }

    const width = document.documentElement.clientWidth
    const overflow = document.documentElement.scrollWidth - width
    const wide: string[] = []
    if (overflow > 0) {
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.right > width + 1 && visible(el) && !el.closest('[class*="overflow-x-auto"],[class*="overflow-auto"],[class*="overflow-hidden"],[class*="overflow-x-hidden"]')) {
          wide.push(`${describe(el)} right=${Math.round(r.right)}`)
        }
      }
    }

    const brokenImages = [...document.images].filter(img => img.complete && img.naturalWidth === 0 && visible(img)).map(img => img.currentSrc || img.src)

    const lowContrast: string[] = []
    const seen = new Set<Element>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const el = text.parentElement
      if (!el || seen.has(el) || !(text.textContent ?? '').trim() || !visible(el) || el.closest('[aria-hidden="true"],svg,.sr-only,script,style')) {
        continue
      }
      seen.add(el)
      const style = getComputedStyle(el)
      const bg = surface(el)
      if (!bg) {
        continue
      }
      let opacity = 1
      for (let node: Element | null = el; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity || 1)
      }
      const fgRaw = rgba(style.color)
      const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacity], bg)
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
      const ratio = (hi! + 0.05) / (lo! + 0.05)
      const size = Number.parseFloat(style.fontSize)
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
      const disabled = el.closest('[disabled],[aria-disabled="true"]')
      if (!disabled && ratio < (large ? 3 : 4.5)) {
        lowContrast.push(`${ratio.toFixed(2)} ${describe(el)}`)
      }
    }

    const failedFonts = [...document.fonts].filter(f => f.status === 'error').map(f => `${f.family} ${f.weight}`)
    return { overflow, wide: wide.slice(0, 6), brokenImages, lowContrast: lowContrast.slice(0, 25), lowContrastCount: lowContrast.length, failedFonts }
  })
}

async function screensFor(client: Client, kind: 'customer' | 'admin'): Promise<string[]> {
  const pick = async (url: string, take: (b: any) => any) => {
    try {
      return take((await client.json<any>(url)).body)
    }
    catch {
      return undefined
    }
  }
  if (kind === 'customer') {
    const project = await pick('/api/orders', b => b.data?.[0]?.id)
    const ticket = await pick('/api/support/tickets', b => (b.tickets ?? b.data ?? b)?.[0]?.id)
    return [
      '/dashboards/balance',
      '/dashboards/services',
      '/dashboards/services?service=web',
      '/dashboards/orders',
      ...(project ? [`/dashboards/orders?project=${project}`] : []),
      '/dashboards/wallet',
      '/dashboards/wallet?credit=apply',
      '/dashboards/support',
      '/dashboards/support?tab=new',
      ...(ticket ? [`/dashboards/support?ticket=${ticket}`] : []),
      '/dashboards/settings',
      '/dashboards/settings?section=business',
      '/dashboards/settings?section=security',
    ]
  }
  const project = await pick('/api/admin/projects?pageSize=1', b => b.items?.[0]?.id)
  const user = await pick('/api/admin/users?pageSize=1', b => b.items?.[0]?.id)
  const page = await pick('/api/admin/website/documents?collection=pages&pageSize=1', b => b.items?.[0]?.id)
  return [
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
    '/admin/website/pages',
    ...(page ? [`/admin/website/pages/${page}`] : []),
    '/admin/website/insights',
    '/admin/website/case-studies',
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
}

async function run(browser: import('@playwright/test').Browser, kind: 'customer' | 'admin') {
  const client = kind === 'customer' ? await customerClient() : await ownerClient()
  const screens = await screensFor(client, kind)
  for (const view of VIEWS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height } })
      await useSession(context, client)
      await instrument(context, theme)
      const page = await context.newPage()
      let screen = ''
      const warnings: string[] = []
      page.on('console', (msg) => {
        if ((msg.type() === 'error' || /hydration/i.test(msg.text())) && !/Failed to load resource/.test(msg.text())) {
          warnings.push(`${screen}: ${msg.text().slice(0, 200)}`)
        }
      })
      page.on('pageerror', e => warnings.push(`${screen}: pageerror ${e.message.slice(0, 200)}`))
      page.on('response', (res) => {
        if (res.status() >= 400 && res.url().startsWith(BASE)) {
          warnings.push(`${screen}: ${res.status()} ${res.request().method()} ${res.url().replace(BASE, '')}`)
        }
      })
      for (screen of screens) {
        await page.goto(screen, { waitUntil: 'domcontentloaded' })
        await hydrated(page)
        await page.waitForTimeout(400)
        if (view.name === 'desktop' && theme === 'light') {
          report.perf.push({ kind, screen, ...(await measure(page)) })
        }
        report.visual.push({ kind, screen, view: view.name, theme, ...(await inspect(page)) })
      }
      report.visual.push({ kind, view: view.name, theme, warnings })
      await context.close()
    }
  }
}

test.afterAll(() => {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), base: BASE, ...report }, null, 2))
})

test('customer panel: speed and looks', async ({ browser }) => {
  test.setTimeout(30 * 60_000)
  await run(browser, 'customer')
})

test('admin console: speed and looks', async ({ browser }) => {
  test.setTimeout(40 * 60_000)
  await run(browser, 'admin')
})
