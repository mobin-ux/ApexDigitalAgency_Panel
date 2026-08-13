#!/usr/bin/env node
import process from 'node:process'

/**
 * Post-deployment payment configuration check.
 *
 * Answers one question from OUTSIDE the box, with no secrets in hand:
 * "is the deployed process actually holding usable payment credentials?"
 *
 * It works by probing the webhook endpoints, whose failure modes are
 * unambiguous (see server/api/webhooks/[provider].post.ts):
 *
 *   503 "Provider not configured"  → the registry built no provider, i.e. the
 *                                    secret key is MISSING from the running
 *                                    process's environment. This is the exact
 *                                    symptom of an env var lost on redeploy.
 *   400 "Invalid signature"        → the provider WAS constructed and rejected
 *                                    our unsigned probe. Credentials present.
 *
 * The 400 is the success case: we deliberately send an unsigned body, so a
 * correctly configured endpoint must reject it. An endpoint that accepted
 * this probe would itself be the bug.
 *
 * Usage:
 *   node scripts/verify-payments.mjs [baseUrl]
 *   APEX_URL=https://panel.apexdigi.co.uk node scripts/verify-payments.mjs
 *
 * Exits non-zero when a required rail is misconfigured, so it can gate a
 * deploy script or run in CI.
 */

const BASE = (process.argv[2] || process.env.APEX_URL || 'https://panel.apexdigi.co.uk').replace(/\/$/, '')
const TIMEOUT_MS = 20_000

/** Rails that must be live. `mock` is only a control — never required. */
const REQUIRED = ['stripe']
const OPTIONAL = ['gocardless', 'paypal']

const green = s => `[32m${s}[39m`
const red = s => `[31m${s}[39m`
const amber = s => `[33m${s}[39m`
const dim = s => `[2m${s}[22m`

async function probe(path, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal, redirect: 'manual' })
    const text = await response.text().catch(() => '')
    let message = ''
    try {
      message = JSON.parse(text).message ?? ''
    }
    catch {
      message = ''
    }
    return { status: response.status, message }
  }
  catch (error) {
    return { status: 0, message: error?.name === 'AbortError' ? 'timed out' : String(error?.message ?? error) }
  }
  finally {
    clearTimeout(timer)
  }
}

/**
 * Classify one provider's webhook endpoint.
 * Returns 'configured' | 'missing-credentials' | 'unreachable' | 'unexpected'.
 */
async function checkProvider(name) {
  const { status, message } = await probe(`/api/webhooks/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })

  if (status === 0) {
    return { name, state: 'unreachable', detail: message }
  }
  if (status === 503 && /not configured/i.test(message)) {
    return { name, state: 'missing-credentials', detail: `${status} ${message}` }
  }
  if (status === 400) {
    // Signature rejected — the adapter exists and is verifying. Configured.
    return { name, state: 'configured', detail: `${status} ${message}` }
  }
  return { name, state: 'unexpected', detail: `${status} ${message}`.trim() }
}

async function main() {
  console.log(`\nApex payment configuration check\n${dim(BASE)}\n`)

  const reachable = await probe('/')
  if (reachable.status === 0) {
    console.log(`${red('FAIL')}  site unreachable — ${reachable.detail}`)
    process.exit(1)
  }
  console.log(`${green('OK')}    site responding ${dim(`(HTTP ${reachable.status})`)}`)

  const results = []
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    results.push(await checkProvider(name))
  }

  let failed = false
  for (const { name, state, detail } of results) {
    const required = REQUIRED.includes(name)
    if (state === 'configured') {
      console.log(`${green('OK')}    ${name} credentials present ${dim(`(${detail})`)}`)
    }
    else if (state === 'missing-credentials') {
      const label = required ? red('FAIL') : amber('SKIP')
      const note = required
        ? 'secret key missing from the running process'
        : 'not configured (optional rail)'
      console.log(`${label}  ${name} — ${note} ${dim(`(${detail})`)}`)
      if (required) {
        failed = true
      }
    }
    else {
      const label = required ? red('FAIL') : amber('WARN')
      console.log(`${label}  ${name} — unexpected response ${dim(`(${detail})`)}`)
      if (required) {
        failed = true
      }
    }
  }

  if (failed) {
    console.log(`\n${red('Payment rails are NOT correctly configured.')}`)
    console.log(dim([
      'Fix on the server, then re-run this check:',
      '  1. ssh into the box',
      '  2. edit /opt/apex/.env.production — set NUXT_PAYMENTS_STRIPE_SECRET_KEY',
      '     and NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET',
      '  3. sudo systemctl restart apex',
      '',
      'Note: a live sk_live_ key still will not charge until',
      '`payments.live-mode` is enabled in Admin -> Settings.',
    ].join('\n')))
    process.exit(1)
  }

  console.log(`\n${green('All required payment rails are configured.')}`)
}

main().catch((error) => {
  console.error(red(`check crashed: ${error?.message ?? error}`))
  process.exit(1)
})
