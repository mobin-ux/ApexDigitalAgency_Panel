import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { describe, it } from 'node:test'
import { panelOrderPath, panelOrigin } from '../../../web/app/data/panel.ts'
import { DEFAULT_CATALOG, findPlan, findService } from '../../shared/catalog.ts'

/**
 * The public site's "Start your order" buttons open this panel's New order
 * wizard with `?service=&plan=`. The wizard falls back to the featured plan
 * for an id it does not know, so a misspelt id would quietly order a
 * different plan: every plan the site sells must land on itself.
 */

// The plans each service page sells (web/app/data/plans.ts).
const SITE_PLANS = {
  'website-design': ['starter', 'growth', 'complete'],
  'seo': ['local', 'growth', 'commerce'],
  'ppc': ['search', 'multi-channel', 'b2b'],
  'digital-marketing': ['essentials', 'growth', 'partner'],
  'ui-ux-design': ['review', 'redesign', 'product'],
  'branding': ['starter', 'identity', 'brand-web'],
} as const

function open(path: string) {
  const query = new URL(path, 'https://panel.test').searchParams
  const service = findService(DEFAULT_CATALOG, query.get('service'))
  return { service, plan: findPlan(service, query.get('plan')) }
}

describe('the site\'s order links', () => {
  it('every plan the site sells opens that plan in the wizard', () => {
    for (const [slug, plans] of Object.entries(SITE_PLANS)) {
      for (const plan of plans) {
        const path = panelOrderPath(slug as keyof typeof SITE_PLANS, plan)
        assert.ok(path.startsWith('/dashboards/services?'), path)
        const opened = open(path)
        assert.ok(opened.service, `${slug}: no service for ${path}`)
        assert.ok(opened.plan, `${slug}/${plan}: no plan for ${path}`)
      }
    }
  })

  it('software, which the site scopes on a call, opens its service', () => {
    assert.equal(open(panelOrderPath('software-development')).service?.id, 'soft')
  })

  it('takes the panel origin only as a bare http(s) address', () => {
    assert.equal(panelOrigin('https://panel.apexdigi.co.uk/'), 'https://panel.apexdigi.co.uk')
    assert.equal(panelOrigin(' http://localhost:3010 '), 'http://localhost:3010')
    for (const bad of ['', '   ', 'panel.apexdigi.co.uk', 'javascript:alert(1)', 'https://panel.apexdigi.co.uk/path', undefined, 42]) {
      assert.equal(panelOrigin(bad), '', String(bad))
    }
  })
})
