import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The staff side of the API harness (ADR-025). Staff reach the admin API only
 * through the staff sign-in, which always asks for an authenticator code, so
 * the harness plays the authenticator: it enrols each staff account it uses
 * through the real `enrol/start` + `enrol/finish` routes, keeps the secret,
 * the last step it used and the session cookie in `.demo/.data/test-staff.json`
 * (git-ignored, local database only), and computes codes itself. Suites run as
 * separate processes, so the cookie is reused while the server still takes it
 * rather than signing in (and spending a code step) every time.
 */

interface Stored { secret: string, lastStep: number, cookie: string }

/** A failure to start a staff session, as opposed to an assertion. */
export class StaffHarnessError extends Error {}

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../.data/test-staff.json')
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function load(): Record<string, Stored> {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  }
  catch {
    return {}
  }
}

function save(email: string, value: Stored) {
  const all = load()
  all[email] = value
  mkdirSync(dirname(FILE), { recursive: true })
  writeFileSync(FILE, JSON.stringify(all, null, 2))
}

function fromBase32(text: string): Buffer {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of text.replace(/[\s=]/g, '').toUpperCase()) {
    value = (value << 5) | ALPHABET.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** RFC 6238, SHA-1, six digits, 30 seconds: what `server/utils/totp.ts` checks. */
export function totp(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac('sha1', fromBase32(secret)).update(counter).digest()
  const offset = mac[mac.length - 1]! & 0x0F
  const binary = ((mac[offset]! & 0x7F) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!
  return String(binary % 1_000_000).padStart(6, '0')
}

/**
 * A step the server will still take: newer than the last one used, and within
 * one step of now. Waits for the next 30-second step when all three are spent.
 */
async function freshStep(lastStep: number): Promise<number> {
  for (;;) {
    const now = Math.floor(Date.now() / 30_000)
    for (const step of [now - 1, now, now + 1]) {
      if (step > lastStep) {
        return step
      }
    }
    await new Promise(r => setTimeout(r, 1_000))
  }
}

/**
 * A code for a sign-in typed in a browser (the smoke tests): the next step of
 * the stored secret that nobody has used, recorded as used so the API suites
 * do not try to spend it again.
 */
export async function nextCodeFor(email: string): Promise<string> {
  const stored = load()[email]
  if (!stored?.secret) {
    throw new StaffHarnessError(`no authenticator secret is stored for ${email}; sign in through the API harness first`)
  }
  const step = await freshStep(stored.lastStep)
  save(email, { ...stored, lastStep: step })
  return totp(stored.secret, step)
}

interface Post { status: number, body: any, cookie: string }

type PostFn = (path: string, json: unknown) => Promise<Post>

/**
 * A staff session cookie for `email`: the stored one if the server still
 * accepts it, else a fresh sign-in with a computed code, enrolling the
 * account first when it has no two-step (or when the stored secret is not
 * the one the database holds).
 */
export async function staffCookie(email: string, password: string, post: PostFn, stillValid: (cookie: string) => Promise<boolean>, resetTwoFactor: () => Promise<void>): Promise<string> {
  const stored = load()[email]
  if (stored?.cookie && await stillValid(stored.cookie)) {
    return stored.cookie
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const login = await post('/api/admin/auth/login', { email, password })
    if (login.status !== 200) {
      throw new StaffHarnessError(`staff login as ${email} answered ${login.status}: ${JSON.stringify(login.body)}`)
    }
    if (login.body.status === 'enrol') {
      const start = await post('/api/admin/auth/enrol/start', { ticket: login.body.ticket })
      const secret = start.body.secret as string
      const step = await freshStep(-1)
      const finish = await post('/api/admin/auth/enrol/finish', { ticket: login.body.ticket, code: totp(secret, step) })
      if (finish.status !== 200) {
        throw new StaffHarnessError(`enrolment for ${email} answered ${finish.status}: ${JSON.stringify(finish.body)}`)
      }
      save(email, { secret, lastStep: step, cookie: finish.cookie })
      return finish.cookie
    }
    if (!stored?.secret) {
      // Two-step is on with a secret this harness never saw: start over.
      await resetTwoFactor()
      continue
    }
    const step = await freshStep(stored.lastStep)
    const code = await post('/api/admin/auth/login-2fa', { ticket: login.body.ticket, code: totp(stored.secret, step) })
    if (code.status === 200) {
      save(email, { secret: stored.secret, lastStep: step, cookie: code.cookie })
      return code.cookie
    }
    await resetTwoFactor()
  }
  throw new StaffHarnessError(`could not start a staff session for ${email}`)
}
