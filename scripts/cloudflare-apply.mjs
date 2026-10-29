#!/usr/bin/env node
import dns from 'node:dns/promises'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import {
  botManagement,
  ORIGIN_IP,
  PANEL_HOST,
  SITE_HOST,
  records as wantedRecords,
  rulesets as wantedRulesets,
  settings as wantedSettings,
  WWW_HOST,
  ZONE,
} from '../deploy/cloudflare-zone.mjs'

/**
 * Make the Cloudflare zone match deploy/cloudflare-zone.mjs (ADR-023).
 *
 * Usage:
 *   node scripts/cloudflare-apply.mjs                 # plan: show every difference, change nothing
 *   node scripts/cloudflare-apply.mjs --apply         # make the zone match the file
 *   node scripts/cloudflare-apply.mjs --apply --dns-only   # same, but every record unproxied (step one)
 *   node scripts/cloudflare-apply.mjs --check         # no token: what the public internet sees right now
 *
 * The token is read from CLOUDFLARE_API_TOKEN, or from the file named by
 * CLOUDFLARE_API_TOKEN_FILE. It belongs to the operator's machine only — never
 * to the server, never to an .env file in the repository, never to chat. A
 * zone-scoped token with these permissions is enough (docs/DEPLOYMENT.md §11):
 * Zone:Read, DNS:Edit, Zone Settings:Edit, Zone WAF:Edit, Cache Rules:Edit,
 * Bot Management:Edit (optional; the script reports what it cannot reach).
 *
 * Rules the script lives by:
 *   - a plan is the default; nothing is written without --apply;
 *   - records it does not know are listed, never touched;
 *   - a ruleset phase that holds a rule not named `apex: …` is left alone and
 *     reported, unless --replace-rules is given;
 *   - the token is never printed, and errors are reported per item so one
 *     setting the plan lacks does not stop the rest.
 */

// CLOUDFLARE_API_BASE exists for the mock the tests run against; never set it otherwise.
const API = process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4'
const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const DNS_ONLY = args.has('--dns-only')
const CHECK_ONLY = args.has('--check')
const REPLACE_RULES = args.has('--replace-rules')
const OWNED = 'apex:'

let changes = 0
let failures = 0
const log = (line = '') => process.stdout.write(`${line}\n`)
function fail(line) {
  failures++
  process.stdout.write(`  ✗ ${line}\n`)
}

function readToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN.trim()
  }
  if (process.env.CLOUDFLARE_API_TOKEN_FILE) {
    return readFileSync(process.env.CLOUDFLARE_API_TOKEN_FILE, 'utf8').trim()
  }
  return ''
}

/** One API call; returns the `result`, or throws with the API's own messages. */
async function cf(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    const messages = (json.errors ?? []).map(e => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`
    const err = new Error(messages)
    err.status = res.status
    err.notFound = res.status === 404
    throw err
  }
  return json.result
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------------------
// DNS
// ---------------------------------------------------------------------------
async function syncRecords(token, zoneId) {
  log('DNS records')
  const live = await cf(token, 'GET', `/zones/${zoneId}/dns_records?per_page=500`)
  const wanted = wantedRecords.map(r => ({ ...r, proxied: DNS_ONLY ? false : r.proxied }))
  const managedNames = new Set(wanted.map(r => `${r.type} ${r.name}`))

  for (const r of wanted) {
    const match = live.find(l => l.type === r.type && l.name === r.name)
    const desired = { type: r.type, name: r.name, content: r.content, proxied: r.proxied, ttl: 1, comment: r.comment }
    if (!match) {
      changes++
      log(`  + ${r.type} ${r.name} → ${r.content} ${r.proxied ? '(proxied)' : '(DNS only)'}`)
      if (APPLY) {
        await cf(token, 'POST', `/zones/${zoneId}/dns_records`, desired).catch(e => fail(`create ${r.name}: ${e.message}`))
      }
      continue
    }
    const diff = []
    if (match.content !== r.content) {
      diff.push(`content ${match.content} → ${r.content}`)
    }
    if (match.proxied !== r.proxied) {
      diff.push(`proxied ${match.proxied} → ${r.proxied}`)
    }
    if (diff.length === 0) {
      log(`  = ${r.type} ${r.name} → ${match.content} ${match.proxied ? '(proxied)' : '(DNS only)'}`)
      continue
    }
    changes++
    log(`  ~ ${r.type} ${r.name}: ${diff.join(', ')}`)
    if (APPLY) {
      await cf(token, 'PATCH', `/zones/${zoneId}/dns_records/${match.id}`, desired).catch(e => fail(`update ${r.name}: ${e.message}`))
    }
  }

  const others = live.filter(l => !managedNames.has(`${l.type} ${l.name}`))
  if (others.length > 0) {
    log('  other records in the zone, left alone:')
    for (const o of others) {
      log(`    ${o.type} ${o.name} → ${String(o.content).slice(0, 60)}${o.proxied ? ' (proxied)' : ''}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Zone settings
// ---------------------------------------------------------------------------
async function syncSettings(token, zoneId) {
  log('\nZone settings')
  const live = await cf(token, 'GET', `/zones/${zoneId}/settings`)
  const current = new Map(live.map(s => [s.id, s]))
  for (const [id, value] of Object.entries(wantedSettings)) {
    const s = current.get(id)
    if (!s) {
      log(`  · ${id}: not offered on this zone's plan (wanted ${JSON.stringify(value)}) — skipped`)
      continue
    }
    if (same(s.value, value)) {
      log(`  = ${id}: ${JSON.stringify(value)}`)
      continue
    }
    changes++
    log(`  ~ ${id}: ${JSON.stringify(s.value)} → ${JSON.stringify(value)}${s.editable === false ? ' (read-only on this plan)' : ''}`)
    if (APPLY && s.editable !== false) {
      await cf(token, 'PATCH', `/zones/${zoneId}/settings/${id}`, { value }).catch(e => fail(`${id}: ${e.message}`))
    }
  }
}

async function syncBotManagement(token, zoneId) {
  log('\nBot management')
  let live
  try {
    live = await cf(token, 'GET', `/zones/${zoneId}/bot_management`)
  }
  catch (e) {
    log(`  · not readable with this token (${e.message}); check "Bot Fight Mode" is off in the dashboard`)
    return
  }
  const diff = Object.entries(botManagement).filter(([k, v]) => live[k] !== v)
  if (diff.length === 0) {
    log(`  = fight_mode: ${live.fight_mode}`)
    return
  }
  changes++
  for (const [k, v] of diff) {
    log(`  ~ ${k}: ${live[k]} → ${v}`)
  }
  if (APPLY) {
    await cf(token, 'PUT', `/zones/${zoneId}/bot_management`, { ...botManagement }).catch(e => fail(`bot management: ${e.message}`))
  }
}

// ---------------------------------------------------------------------------
// Rulesets (one entrypoint per phase)
// ---------------------------------------------------------------------------
function ruleShape(r) {
  return {
    description: r.description,
    expression: r.expression,
    action: r.action,
    action_parameters: r.action_parameters ?? null,
    ratelimit: r.ratelimit ?? null,
    logging: r.logging ?? null,
    enabled: r.enabled ?? true,
  }
}

async function syncRulesets(token, zoneId) {
  log('\nRulesets')
  for (const [phase, wanted] of Object.entries(wantedRulesets)) {
    let live = []
    try {
      const entry = await cf(token, 'GET', `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`)
      live = entry.rules ?? []
    }
    catch (e) {
      if (!e.notFound) {
        fail(`${phase}: ${e.message}`)
        continue
      }
    }
    const foreign = live.filter(r => !(r.description ?? '').startsWith(OWNED))
    if (foreign.length > 0 && !REPLACE_RULES) {
      log(`  ! ${phase}: holds ${foreign.length} rule(s) this repository does not own — left alone (use --replace-rules to replace them):`)
      for (const r of foreign) {
        log(`      "${r.description ?? '(no description)'}" ${r.action}`)
      }
      continue
    }
    const liveShape = live.map(ruleShape)
    const wantedShape = wanted.map(ruleShape)
    if (same(liveShape, wantedShape)) {
      log(`  = ${phase}: ${wanted.length} rule(s) as in the file`)
      continue
    }
    changes++
    log(`  ~ ${phase}: ${live.length} live rule(s) → ${wanted.length} from the file`)
    for (const r of wanted) {
      log(`      "${r.description}"`)
    }
    if (APPLY) {
      const rules = wanted.map(r => ({ ...r, enabled: r.enabled ?? true }))
      await cf(token, 'PUT', `/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, { rules })
        .catch(e => fail(`${phase}: ${e.message}`))
    }
  }
}

// ---------------------------------------------------------------------------
// What the internet sees (no token needed)
// ---------------------------------------------------------------------------
function inCidr(ip, cidr) {
  const [range, bitsText] = cidr.split('/')
  const bits = Number(bitsText)
  const toInt = s => s.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (toInt(ip) & mask) === (toInt(range) & mask)
}

/**
 * Resolve through Cloudflare's DNS-over-HTTPS first (so the answer is the
 * authoritative one, not a stale local cache), falling back to the system
 * resolver where DoH is unreachable. A name that cannot be resolved either
 * way answers [] — the caller reports it.
 */
async function resolve(name, type = 'A') {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(15_000),
    })
    const json = await res.json()
    return (json.Answer ?? []).filter(a => (type === 'A' ? a.type === 1 : a.type === 5)).map(a => (a.data.endsWith('.') ? a.data.slice(0, -1) : a.data))
  }
  catch {
    try {
      return type === 'A' ? await dns.resolve4(name) : await dns.resolveCname(name)
    }
    catch {
      return []
    }
  }
}

async function probe(url, expect) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })
    const h = res.headers
    const via = h.get('server') === 'cloudflare' && h.get('cf-ray') ? 'through Cloudflare' : 'direct'
    const extra = []
    if (h.get('cf-cache-status')) {
      extra.push(`cache ${h.get('cf-cache-status')}`)
    }
    if (h.get('location')) {
      extra.push(`→ ${h.get('location')}`)
    }
    if (h.get('strict-transport-security')) {
      extra.push('hsts')
    }
    if (h.get('content-security-policy')) {
      extra.push('csp')
    }
    const ok = expect === undefined || expect(res)
    log(`  ${ok ? '✓' : '✗'} ${url} → ${res.status} ${via}${extra.length ? ` (${extra.join(', ')})` : ''}`)
    if (!ok) {
      failures++
    }
    return res
  }
  catch (e) {
    fail(`${url}: ${e.cause?.code ?? e.message}`)
    return null
  }
}

async function checkPublic() {
  log('\nWhat the public internet sees')
  let v4 = []
  try {
    v4 = (await (await fetch('https://www.cloudflare.com/ips-v4', { signal: AbortSignal.timeout(15_000) })).text()).trim().split('\n')
  }
  catch {
    log('  · could not fetch Cloudflare\'s IPv4 ranges; proxied state is judged by headers only')
  }
  for (const host of [SITE_HOST, WWW_HOST, PANEL_HOST]) {
    const a = await resolve(host, 'A')
    const cname = await resolve(host, 'CNAME')
    const addrs = [...a]
    const proxied = addrs.length > 0 && v4.length > 0 && addrs.every(ip => v4.some(c => inCidr(ip, c)))
    const atOrigin = addrs.includes(ORIGIN_IP)
    if (addrs.length === 0 && cname.length === 0) {
      fail(`${host}: no record — not reachable by name`)
      continue
    }
    const state = proxied ? 'proxied (Cloudflare addresses)' : atOrigin ? 'DNS only (origin address exposed)' : 'other'
    log(`  ${proxied ? '✓' : '·'} ${host} → ${cname.length ? `CNAME ${cname.join(' ')} → ` : ''}${addrs.join(' ')} — ${state}`)
  }
  await probe(`https://${SITE_HOST}/`, r => r.status === 200)
  await probe(`https://${WWW_HOST}/`, r => r.status === 301 && (r.headers.get('location') ?? '').startsWith(`https://${SITE_HOST}`))
  await probe(`https://${PANEL_HOST}/auth/login-1`, r => r.status === 200)
  await probe(`https://${PANEL_HOST}/api/config`, r => r.status === 200 && /no-store/.test(r.headers.get('cache-control') ?? ''))
  await probe(`http://${SITE_HOST}/`, r => r.status >= 301 && r.status <= 308)
  const nuxt = await probe(`https://${SITE_HOST}/_nuxt/builds/meta/`, undefined)
  if (nuxt && nuxt.status === 404) {
    log('    (a 404 there is fine; the probe only shows whether /_nuxt/ answers through the edge)')
  }
}

// ---------------------------------------------------------------------------
async function main() {
  log(`Cloudflare zone ${ZONE} — ${CHECK_ONLY ? 'public check' : APPLY ? 'APPLY' : 'plan (nothing is changed)'}${DNS_ONLY ? ', every record DNS only' : ''}`)
  if (!CHECK_ONLY) {
    const token = readToken()
    if (!token) {
      log('No token: set CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_TOKEN_FILE (or run with --check).')
      process.exit(2)
    }
    const verify = await cf(token, 'GET', '/user/tokens/verify').catch((e) => {
      log(`The token was refused: ${e.message}`)
      process.exit(2)
    })
    log(`Token: ${verify.status}${verify.expires_on ? `, expires ${verify.expires_on}` : ''}`)
    const zones = await cf(token, 'GET', `/zones?name=${ZONE}`)
    if (zones.length !== 1) {
      log(`The token does not reach a zone named ${ZONE} (${zones.length} found).`)
      process.exit(2)
    }
    const zone = zones[0]
    log(`Zone: ${zone.name} (${zone.id.slice(0, 8)}…), status ${zone.status}, plan ${zone.plan?.name ?? '?'}, nameservers ${zone.name_servers?.join(' ') ?? '?'}\n`)

    // Each section on its own, so one missing permission shows up beside the
    // others instead of hiding them behind the first failure.
    for (const [name, step] of [['DNS records', syncRecords], ['Zone settings', syncSettings], ['Bot management', syncBotManagement], ['Rulesets', syncRulesets]]) {
      try {
        await step(token, zone.id)
      }
      catch (e) {
        fail(`${name}: ${e.message}${e.status === 403 || /authentication|permission/i.test(e.message) ? ' — the token lacks this permission (docs/DEPLOYMENT.md §11.1)' : ''}`)
      }
    }

    log(`\n${APPLY ? 'Applied' : 'Planned'} ${changes} change(s)${failures ? `, ${failures} failed` : ''}.`)
    if (!APPLY && changes > 0) {
      log('Run again with --apply to make them (after `bash scripts/ship-caddy.sh`, see docs/DEPLOYMENT.md §11).')
    }
  }
  await checkPublic()
  log(`\n${failures === 0 ? 'Everything answers as expected.' : `${failures} check(s) failed.`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  log(`\nStopped: ${e.message}`)
  process.exit(1)
})
