import type { Permission, StaffRole } from '../../shared/permissions.ts'
import type { Client } from './helpers.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- node --test is the runner (ADR-021)
import { before, describe, it } from 'node:test'
import { can, STAFF_ROLES } from '../../shared/permissions.ts'
import { client, DEV_ACCOUNTS, enabled, login, resetRateLimits, staffClient } from './helpers.ts'

/**
 * Every admin endpoint against every staff role, a customer and nobody
 * (ADR-025, phase 5). The matrix in `shared/permissions.ts` is the expected
 * answer: a role without the permission gets a 403 naming it, a role with it
 * gets past the guard (whatever the handler then says about a record that
 * does not exist or an empty body, but never a 401, a 403 or a 500). No
 * session is a 401; a customer's session is a 403, since they are signed in
 * but are not staff.
 *
 * Writes go to an id that does not exist, with an empty body, so a permitted
 * role is answered by validation or a 404 and nothing in the database moves.
 */
const MISSING = 'role-matrix-missing'

interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  /** The permissions a caller needs, all of them. */
  needs: Permission[]
  body?: unknown
}

const ROUTES: Route[] = [
  // Work
  { method: 'GET', path: '/api/admin/stats', needs: ['work.view'] },
  { method: 'GET', path: '/api/admin/projects', needs: ['work.view'] },
  { method: 'POST', path: '/api/admin/projects', needs: ['work.assign'] },
  { method: 'GET', path: `/api/admin/projects/${MISSING}`, needs: ['work.view'] },
  { method: 'PATCH', path: `/api/admin/projects/${MISSING}`, needs: ['work.assign'] },
  { method: 'DELETE', path: `/api/admin/projects/${MISSING}`, needs: ['work.assign'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/advance`, needs: ['work.assign'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/kickoff`, needs: ['work.assign'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/milestones`, needs: ['work.assign'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/notes`, needs: ['work.assign'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/actions`, needs: ['work.assign'] },
  { method: 'DELETE', path: `/api/admin/projects/${MISSING}/actions/${MISSING}`, needs: ['work.assign'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/deliverables/release`, needs: ['work.release'] },
  { method: 'POST', path: `/api/admin/projects/${MISSING}/deliverables/withdraw`, needs: ['work.release'] },
  { method: 'PATCH', path: `/api/admin/milestones/${MISSING}`, needs: ['work.assign'] },
  { method: 'DELETE', path: `/api/admin/milestones/${MISSING}`, needs: ['work.assign'] },
  { method: 'GET', path: '/api/admin/services', needs: ['work.view'] },
  { method: 'PUT', path: '/api/admin/services', needs: ['catalogue.edit'] },
  // People
  { method: 'GET', path: '/api/admin/users', needs: ['work.view'] },
  { method: 'POST', path: '/api/admin/users', needs: ['clients.approve'] },
  { method: 'GET', path: `/api/admin/users/${MISSING}`, needs: ['work.view'] },
  { method: 'PATCH', path: `/api/admin/users/${MISSING}`, needs: ['clients.approve'] },
  { method: 'PUT', path: `/api/admin/users/${MISSING}/company`, needs: ['clients.approve'] },
  { method: 'POST', path: `/api/admin/users/${MISSING}/two-factor-reset`, needs: ['clients.approve'] },
  { method: 'GET', path: '/api/admin/tickets', needs: ['support.answer'] },
  { method: 'GET', path: `/api/admin/tickets/${MISSING}`, needs: ['support.answer'] },
  { method: 'PATCH', path: `/api/admin/tickets/${MISSING}`, needs: ['support.answer'] },
  { method: 'POST', path: `/api/admin/tickets/${MISSING}/reply`, needs: ['support.answer'] },
  { method: 'GET', path: '/api/admin/team', needs: ['team.manage'] },
  { method: 'PATCH', path: `/api/admin/team/${MISSING}`, needs: ['team.manage'] },
  { method: 'POST', path: '/api/admin/team/invites', needs: ['team.manage'] },
  { method: 'DELETE', path: `/api/admin/team/invites/${MISSING}`, needs: ['team.manage'] },
  { method: 'POST', path: `/api/admin/team/invites/${MISSING}/resend`, needs: ['team.manage'] },
  // Money
  { method: 'GET', path: '/api/admin/finance/summary', needs: ['money.view'] },
  { method: 'GET', path: '/api/admin/finance/transactions', needs: ['money.view'] },
  { method: 'GET', path: '/api/admin/finance/installments', needs: ['money.view'] },
  { method: 'PATCH', path: `/api/admin/finance/installments/${MISSING}`, needs: ['money.view'], body: { action: 'charge' } },
  { method: 'PATCH', path: `/api/admin/finance/installments/${MISSING}`, needs: ['money.view', 'money.refund'], body: { action: 'waive' } },
  { method: 'GET', path: '/api/admin/finance/withdrawals', needs: ['money.view'] },
  { method: 'PATCH', path: `/api/admin/finance/withdrawals/${MISSING}`, needs: ['money.view'], body: { action: 'reject' } },
  { method: 'PATCH', path: `/api/admin/finance/withdrawals/${MISSING}`, needs: ['money.view', 'money.refund'], body: { action: 'approve' } },
  { method: 'POST', path: '/api/admin/finance/refund', needs: ['money.refund'] },
  { method: 'GET', path: '/api/admin/finance/credit', needs: ['money.view'] },
  { method: 'PATCH', path: `/api/admin/finance/credit/${MISSING}`, needs: ['credit.approve'] },
  { method: 'GET', path: '/api/admin/credit/applications', needs: ['money.view'] },
  { method: 'POST', path: `/api/admin/credit/applications/${MISSING}/decide`, needs: ['credit.approve'] },
  { method: 'GET', path: '/api/admin/contracts', needs: ['money.view'] },
  { method: 'GET', path: `/api/admin/contracts/${MISSING}`, needs: ['money.view'] },
  { method: 'PATCH', path: `/api/admin/contracts/${MISSING}`, needs: ['money.view'] },
  { method: 'GET', path: '/api/admin/payments/health', needs: ['money.view'] },
  // Website (ADR-026)
  { method: 'GET', path: '/api/admin/website/documents?collection=pages', needs: ['website.view'] },
  { method: 'POST', path: '/api/admin/website/documents', needs: ['website.edit'] },
  { method: 'GET', path: `/api/admin/website/documents/${MISSING}`, needs: ['website.view'] },
  { method: 'PUT', path: `/api/admin/website/documents/${MISSING}/draft`, needs: ['website.edit'] },
  { method: 'POST', path: `/api/admin/website/documents/${MISSING}/submit`, needs: ['website.edit'] },
  { method: 'POST', path: `/api/admin/website/documents/${MISSING}/withdraw`, needs: ['website.edit'] },
  { method: 'POST', path: `/api/admin/website/documents/${MISSING}/request-changes`, needs: ['website.publish'] },
  { method: 'POST', path: `/api/admin/website/documents/${MISSING}/publish`, needs: ['website.publish'] },
  { method: 'POST', path: `/api/admin/website/documents/${MISSING}/restore`, needs: ['website.edit'] },
  { method: 'POST', path: `/api/admin/website/documents/${MISSING}/preview`, needs: ['website.view'] },
  { method: 'PATCH', path: `/api/admin/website/documents/${MISSING}/path`, needs: ['website.edit'] },
  { method: 'GET', path: '/api/admin/website/history', needs: ['website.view'] },
  { method: 'GET', path: '/api/admin/website/review-counts', needs: ['website.view'] },
  { method: 'GET', path: '/api/admin/website/media', needs: ['website.view'] },
  { method: 'POST', path: '/api/admin/website/media', needs: ['website.media'] },
  { method: 'PATCH', path: `/api/admin/website/media/${MISSING}`, needs: ['website.media'] },
  { method: 'DELETE', path: `/api/admin/website/media/${MISSING}`, needs: ['website.media'] },
  { method: 'GET', path: '/api/admin/website/redirects', needs: ['website.view'] },
  { method: 'POST', path: '/api/admin/website/redirects', needs: ['website.seo'] },
  { method: 'POST', path: '/api/admin/website/redirects/check', needs: ['website.seo'] },
  { method: 'DELETE', path: `/api/admin/website/redirects/${MISSING}`, needs: ['website.seo'] },
  { method: 'GET', path: '/api/admin/website/seo', needs: ['website.view'] },
  // Per key after this gate: Site settings need website.settings, robots.txt website.seo (website-structure.test.ts).
  { method: 'GET', path: '/api/admin/website/settings', needs: ['website.view'] },
  { method: 'PUT', path: '/api/admin/website/settings', needs: ['website.view'] },
  // Idempotent: a permitted role re-reads the site's baseline and adds only what is missing.
  { method: 'POST', path: '/api/admin/website/import', needs: ['website.publish'] },
  // System
  { method: 'GET', path: '/api/admin/settings', needs: ['platform.settings'] },
  { method: 'PUT', path: '/api/admin/settings', needs: ['platform.settings'] },
  { method: 'GET', path: '/api/admin/audit', needs: ['team.manage'] },
  { method: 'GET', path: '/api/admin/mail', needs: ['team.manage'] },
  { method: 'POST', path: '/api/admin/mail/test', needs: ['team.manage'] },
  { method: 'POST', path: `/api/admin/mail/${MISSING}/retry`, needs: ['team.manage'] },
  { method: 'POST', path: '/api/admin/notifications/broadcast', needs: ['catalogue.edit'] },
]

function call(actor: Client, route: Route) {
  const write = route.method !== 'GET'
  return actor.json<any>(route.path, { method: route.method, ...(write ? { json: route.body ?? {} } : {}) })
}

const label = (r: Route) => `${r.method} ${r.path.replace(MISSING, ':id').replace(MISSING, ':id')}${r.body ? ` ${JSON.stringify(r.body)}` : ''}`

describe('every admin endpoint × every role', { skip: !enabled && 'CMS_TEST_URL is not set', timeout: 600_000 }, () => {
  const staff = new Map<StaffRole, Client>()
  let customer: Client

  before(async () => {
    const owner = await login(DEV_ACCOUNTS.owner.identifier, DEV_ACCOUNTS.owner.password)
    staff.set('owner', owner)
    for (const role of STAFF_ROLES.filter(r => r !== 'owner')) {
      staff.set(role, await staffClient(owner, role))
    }
    customer = await login(DEV_ACCOUNTS.customer.identifier, DEV_ACCOUNTS.customer.password)
  })

  it('every admin route on disk is in the matrix', async () => {
    const { readdirSync } = await import('node:fs')
    const { join, relative } = await import('node:path')
    const root = join(import.meta.dirname, '../../server/api/admin')
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
    const onDisk = walk(root)
      .map(f => relative(root, f).replaceAll('\\', '/'))
      .filter(f => !f.startsWith('auth/')) // the staff sign-in itself is public (staff-auth.test.ts)
      .map((f) => {
        const [, path, method] = f.match(/^(.*?)\.(get|post|patch|put|delete)\.ts$/)!
        const url = `/api/admin/${path!.replace(/\/?index$/, '').replace(/\[[^\]]+\]/g, MISSING)}`
        return `${method!.toUpperCase()} ${url}`
      })
    // A row may carry the query a list needs (`?collection=`); the file has none.
    const covered = new Set(ROUTES.map(r => `${r.method} ${r.path.split('?')[0]}`))
    assert.deepEqual(onDisk.filter(r => !covered.has(r)), [], 'routes with no row in the matrix')
  })

  for (const role of STAFF_ROLES) {
    it(`${role}: the matrix decides, route by route`, async () => {
      await resetRateLimits()
      const actor = staff.get(role)!
      const wrong: string[] = []
      for (const route of ROUTES) {
        const res = await call(actor, route)
        const allowed = route.needs.every(p => can(role, p))
        if (res.status >= 500) {
          wrong.push(`${label(route)} → ${res.status}`)
        }
        else if (allowed && (res.status === 401 || res.status === 403)) {
          wrong.push(`${label(route)} → ${res.status}, but ${role} holds ${route.needs.join(' + ')}`)
        }
        else if (!allowed && res.status !== 403) {
          wrong.push(`${label(route)} → ${res.status}, expected 403 for ${role}`)
        }
        else if (!allowed && !route.needs.includes(res.body?.data?.permission)) {
          wrong.push(`${label(route)} → 403 naming ${res.body?.data?.permission}, expected one of ${route.needs.join(', ')}`)
        }
      }
      assert.deepEqual(wrong, [])
    })
  }

  it('a customer is refused with a 403 and nobody signed in with a 401', async () => {
    const wrong: string[] = []
    for (const [who, actor, expected] of [['customer', customer, 403], ['anonymous', client(), 401]] as const) {
      for (const route of ROUTES) {
        const res = await call(actor, route)
        if (res.status !== expected) {
          wrong.push(`${who}: ${label(route)} → ${res.status}`)
        }
      }
    }
    assert.deepEqual(wrong, [])
  })
})
