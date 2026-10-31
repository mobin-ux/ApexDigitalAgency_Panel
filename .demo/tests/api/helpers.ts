import process from 'node:process'

/**
 * Helpers for the API suites, which run against a live panel dev server on a
 * copy* of the local database:
 *
 *   cp prisma/dev.db .data/test.db
 *   DATABASE_URL=file:<absolute>/.data/test.db pnpm demo:dev   # any port
 *   CMS_TEST_URL=http://localhost:<port> pnpm test:cms:api
 *
 * Without `CMS_TEST_URL` every suite skips rather than failing, so the unit
 * runner stays green on a machine with no server up. The owner and the
 * customer are the dev accounts `/api/create-admin` seeds; they live only
 * in the local database, which is never committed.
 */

export const BASE = (process.env.CMS_TEST_URL ?? '').replace(/\/$/, '')

export const enabled = BASE !== ''

/** A failure in the harness itself (sign-in, invite), as opposed to an assertion. */
export class HarnessError extends Error {}

export interface Client {
  cookie: string
  fetch: (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response>
  json: <T = any>(path: string, init?: RequestInit & { json?: unknown }) => Promise<{ status: number, body: T }>
}

function headersFor(cookie: string, init?: RequestInit & { json?: unknown }): Headers {
  const headers = new Headers(init?.headers)
  if (cookie) {
    headers.set('cookie', cookie)
  }
  if (init?.json !== undefined) {
    headers.set('content-type', 'application/json')
  }
  // The panel's CSRF check wants a same-origin Origin on writes.
  headers.set('origin', BASE)
  return headers
}

export function client(cookie = ''): Client {
  const doFetch = (path: string, init?: RequestInit & { json?: unknown }) => fetch(`${BASE}${path}`, {
    ...init,
    headers: headersFor(cookie, init),
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    redirect: 'manual',
  })
  return {
    cookie,
    fetch: doFetch,
    async json(path, init) {
      const res = await doFetch(path, init)
      const text = await res.text()
      let body: any = text
      try {
        body = JSON.parse(text)
      }
      catch {
        // not JSON; keep the text
      }
      return { status: res.status, body }
    },
  }
}

/**
 * The sign-in limiter allows five attempts a minute per address and then
 * blocks for fifteen; a suite signs in as every role from one address. The
 * dev server exposes a reset (404 in production), called before each login.
 */
export async function resetRateLimits(): Promise<void> {
  await fetch(`${BASE}/api/_test/reset-rate-limits`, { method: 'POST', headers: { origin: BASE } })
}

/** Sign in and return a client carrying the session cookie, or null on a 401. */
export async function tryLogin(identifier: string, password: string): Promise<Client | null> {
  await resetRateLimits()
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': BASE },
    body: JSON.stringify({ identifier, password }),
  })
  if (res.status === 401) {
    return null
  }
  if (res.status !== 200) {
    throw new HarnessError(`login as ${identifier} answered ${res.status}: ${await res.text()}`)
  }
  const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  if (!cookie.includes('auth_token=')) {
    throw new HarnessError(`login as ${identifier} set no session cookie`)
  }
  return client(cookie)
}

export async function login(identifier: string, password: string): Promise<Client> {
  const result = await tryLogin(identifier, password)
  if (!result) {
    throw new HarnessError(`login as ${identifier} was refused`)
  }
  return result
}

/** The two dev accounts `/api/create-admin` seeds (local only). */
export const DEV_ACCOUNTS = {
  owner: { identifier: 'admin@apex.com', password: 'admin123' },
  customer: { identifier: 'user@apex.com', password: 'user123' },
} as const
