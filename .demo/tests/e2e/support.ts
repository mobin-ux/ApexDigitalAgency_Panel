import type { BrowserContext, Page } from '@playwright/test'
import type { Client } from '../api/helpers.ts'
import { BASE, DEV_ACCOUNTS, login, staffClient } from '../api/helpers.ts'

/**
 * What the smoke tests share: sessions from the API harness (so a test about
 * a screen does not also spend an authenticator code on signing in), and an
 * error trap that fails a test when the page throws.
 */

export const OWNER = DEV_ACCOUNTS.owner
export const CUSTOMER = DEV_ACCOUNTS.customer

let owner: Client | null = null

/** The dev owner on a staff session, through the API harness (enrols it on first use). */
export async function ownerClient(): Promise<Client> {
  owner ??= await login(OWNER.identifier, OWNER.password)
  return owner
}

/** A client for a staff role: the owner, or the harness's test account for the role. */
export async function roleClient(role: string): Promise<Client> {
  const o = await ownerClient()
  return role === 'owner' ? o : staffClient(o, role)
}

export function customerClient(): Promise<Client> {
  return login(CUSTOMER.identifier, CUSTOMER.password)
}

/** Put an API client's session cookies into the browser. */
export async function useSession(context: BrowserContext, api: Client): Promise<void> {
  await context.addCookies(api.cookie.split('; ').filter(Boolean).map((pair) => {
    const at = pair.indexOf('=')
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: BASE }
  }))
}

// The dev server's own noise: HMR and devtools sockets, and a view
// transition the router cancels when a test navigates quickly.
const DEV_NOISE = [/WebSocket connection/, /Transition was aborted/, /\[vite\]/, /Download the Vue Devtools/]

/**
 * Wait until Nuxt has hydrated the page. A form filled before then is still
 * plain HTML, and submitting it reloads the page instead of signing in.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as any)?.__vue_app__))
  await page.waitForLoadState('networkidle')
}

/**
 * Collect what the page throws, logs as an error, or gets back as a failed
 * request (with its address, which the console line leaves out), outside
 * the dev noise.
 */
export function trapErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    if (!DEV_NOISE.some(re => re.test(error.message))) {
      errors.push(`pageerror: ${error.message}`)
    }
  })
  page.on('console', (message) => {
    // A failed request is reported below, with its address.
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text()) && !DEV_NOISE.some(re => re.test(message.text()))) {
      errors.push(`console: ${message.text()}`)
    }
  })
  page.on('response', (response) => {
    // A profile photo whose file is not on this machine (the database travels
    // between checkouts, uploads do not) is a 404 the avatar answers with
    // initials; that is local data, not a fault.
    const missingPhoto = response.status() === 404 && new URL(response.url()).pathname.startsWith('/api/avatars/')
    if (response.status() >= 400 && !missingPhoto) {
      errors.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`)
    }
  })
  return errors
}
