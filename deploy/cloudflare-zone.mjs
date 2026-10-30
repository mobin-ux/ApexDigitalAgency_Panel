/**
 * The Cloudflare zone for apexdigi.co.uk, as code (ADR-023).
 *
 * This file is the desired state. `scripts/cloudflare-apply.mjs` reads it,
 * compares it with the live zone and, only with `--apply`, makes the zone
 * match. Edit here, run the script, commit — the zone and the repository
 * cannot drift apart silently, and the dashboard is never the only record.
 *
 * Everything in it is chosen to fit what the two apps already do:
 *   - the origin (Caddy) holds valid Let's Encrypt certificates for every
 *     hostname, so SSL mode is Full (strict) and the edge never talks to the
 *     origin in the clear;
 *   - the site sends a strict, nonce-based CSP on every HTML response and
 *     the panel sets its own security headers, so every Cloudflare feature
 *     that would inject a script into a page is OFF, and no header is added
 *     or rewritten at the edge;
 *   - HTML is never cached at the edge: the panel's pages are per-user and
 *     the site's carry a per-request CSP nonce. Hashed assets, fonts and
 *     processed images are cached with the TTLs the origin already sets;
 *   - the rate limits and audit rows in the apps key on the client IP, so
 *     Caddy has to be told which addresses are Cloudflare's
 *     (deploy/Caddyfile + scripts/cloudflare-ips.sh) before any record is
 *     proxied, or every visitor shares one bucket.
 */

export const ZONE = 'apexdigi.co.uk'
export const ORIGIN_IP = '146.19.130.11'
export const SITE_HOST = 'apexdigi.co.uk'
export const PANEL_HOST = 'panel.apexdigi.co.uk'
export const WWW_HOST = 'www.apexdigi.co.uk'

/**
 * DNS records the script manages. Anything else in the zone (mail records
 * added for Resend, verification TXT records, …) is left alone and only
 * listed. `proxied: true` puts the record behind the edge; `--dns-only`
 * writes every record unproxied, which is the first step (see
 * docs/DEPLOYMENT.md §11) so the origin can obtain its certificates before
 * the edge starts checking them.
 */
export const records = [
  { type: 'A', name: SITE_HOST, content: ORIGIN_IP, proxied: true, comment: 'apex:site (web/, Caddy :3100)' },
  { type: 'A', name: PANEL_HOST, content: ORIGIN_IP, proxied: true, comment: 'apex:panel (.demo/, Caddy :3000)' },
  { type: 'CNAME', name: WWW_HOST, content: SITE_HOST, proxied: true, comment: 'apex:www redirects to the apex at the edge and at the origin' },
]

/**
 * Zone settings (PATCH /zones/:id/settings/:name). A setting the plan does
 * not include is reported and skipped, never treated as a failure.
 */
export const settings = {
  // --- TLS ---------------------------------------------------------------
  ssl: 'strict', // Full (strict): the origin's Let's Encrypt certs are checked
  always_use_https: 'on', // Cloudflare exempts /.well-known/acme-challenge/ itself
  automatic_https_rewrites: 'on',
  min_tls_version: '1.2',
  tls_1_3: 'zrt', // TLS 1.3 with 0-RTT; the `0rtt` setting mirrors this value, so it is not listed
  opportunistic_encryption: 'on',
  // HSTS is sent by both apps (2 years, includeSubDomains, preload); the
  // edge does not add a second one. `security_header` is deliberately absent.

  // --- Transport ---------------------------------------------------------
  http3: 'on',
  ipv6: 'on',
  websockets: 'on',
  brotli: 'on',
  early_hints: 'on',

  // --- Nothing injected into pages ----------------------------------------
  // Each of these adds a <script> or rewrites markup; the site's CSP would
  // block it and the panel does not want it either.
  rocket_loader: 'off',
  email_obfuscation: 'off',
  server_side_exclude: 'off',
  hotlink_protection: 'off', // social cards must be fetchable by other sites
  mirage: 'off', // paid plans only; skipped on free
  fonts: 'off', // "Cloudflare Fonts" rewrites <link> tags; fonts are self-hosted

  // --- Caching -------------------------------------------------------------
  cache_level: 'aggressive', // default; what is cached is decided by the rules below
  browser_cache_ttl: 0, // 0 = respect the origin's Cache-Control
  development_mode: 'off',

  // --- Security ----------------------------------------------------------
  security_level: 'medium',
  browser_check: 'on',
  challenge_ttl: 1800,
  privacy_pass: 'on',
}

/**
 * Bot Fight Mode injects a challenge script into HTML, which the site's CSP
 * blocks, and it cannot be skipped per path on the free plan, so the panel's
 * webhook endpoints (Stripe, GoCardless, PayPal — authenticated by signature,
 * never by a browser) would be challenged. It stays off; the WAF rule below
 * and the apps' own limiters are the bot defence.
 */
export const botManagement = { fight_mode: false }

/**
 * Paths whose responses are safe and worth caching at the edge, on either
 * host: hashed build assets, processed images, the panel's media library
 * (versioned addresses with a year's immutable cache), fonts and brand files.
 */
const ASSET_PREFIXES = ['/_nuxt/', '/_ipx/', '/media/', '/api/site/media/', '/fonts/', '/brand/', '/icons/', '/img/']

function startsWithAny(prefixes) {
  return `(${prefixes.map(p => `starts_with(http.request.uri.path, "${p}")`).join(' or ')})`
}

/**
 * Rulesets, one entrypoint per phase. The script replaces each phase's
 * entrypoint with exactly these rules, and refuses to do so while the live
 * phase holds a rule it does not own (one whose description does not start
 * with `apex:`), unless `--replace-rules` is given.
 */
export const rulesets = {
  // Redirect www → apex at the edge, so the origin only ever sees the two real
  // hosts. The ACME path is excluded so Caddy can still obtain a certificate
  // for www (its own redirect stays as the fallback when the proxy is off).
  http_request_dynamic_redirect: [
    {
      description: 'apex: www to apex',
      expression: `(http.host eq "${WWW_HOST}" and not starts_with(http.request.uri.path, "/.well-known/acme-challenge/"))`,
      action: 'redirect',
      action_parameters: {
        from_value: {
          status_code: 301,
          target_url: { expression: `concat("https://${SITE_HOST}", http.request.uri.path)` },
          preserve_query_string: true,
        },
      },
    },
  ],

  http_request_cache_settings: [
    {
      description: 'apex: never cache the panel (per-user pages and APIs)',
      expression: `(http.host eq "${PANEL_HOST}" and not ${startsWithAny(ASSET_PREFIXES)})`,
      action: 'set_cache_settings',
      action_parameters: { cache: false },
    },
    {
      description: 'apex: never cache site HTML (per-request CSP nonce), APIs or previews',
      expression: `(http.host eq "${SITE_HOST}" and not ${startsWithAny(ASSET_PREFIXES)})`,
      action: 'set_cache_settings',
      action_parameters: { cache: false },
    },
    {
      description: 'apex: cache hashed assets, fonts and images with the origin TTL',
      expression: `((http.host eq "${SITE_HOST}" or http.host eq "${PANEL_HOST}") and ${startsWithAny(ASSET_PREFIXES)})`,
      action: 'set_cache_settings',
      action_parameters: {
        cache: true,
        edge_ttl: { mode: 'respect_origin' },
        browser_ttl: { mode: 'respect_origin' },
      },
    },
  ],

  // Payment webhooks are signed server-to-server POSTs with no browser
  // behind them: nothing at the edge may challenge or rate-limit them (the
  // app verifies the HMAC and dedupes by event id).
  http_request_firewall_custom: [
    {
      description: 'apex: payment webhooks skip edge rate limits and challenges',
      expression: `(http.host eq "${PANEL_HOST}" and starts_with(http.request.uri.path, "/api/webhooks/"))`,
      action: 'skip',
      action_parameters: {
        ruleset: 'current',
        phases: ['http_ratelimit'],
        products: ['securityLevel', 'bic'],
      },
      logging: { enabled: true },
    },
  ],

  // Web Analytics' automatic setup injected a third-party beacon
  // (static.cloudflareinsights.com) into every HTML page on both hosts and
  // POSTed /cdn-cgi/rum on every view — 19 s on a slow link. No analytics
  // site exists in the account to delete, so this switches it off (2026-10-30).
  http_config_settings: [
    {
      description: 'apex: no Web Analytics beacon injected into pages',
      expression: 'true',
      action: 'set_config',
      action_parameters: { disable_rum: true },
    },
  ],

  // One rule (the free plan's allowance), well above the apps' own limits
  // (sign-in 5/min, contact 5/10 min): it absorbs floods before they reach
  // the in-process limiters, which keep deciding the real policy.
  http_ratelimit: [
    {
      description: 'apex: flood guard on sign-in, account and contact writes',
      expression: `(http.request.method eq "POST" and ((http.host eq "${PANEL_HOST}" and starts_with(http.request.uri.path, "/api/auth/")) or (http.host eq "${SITE_HOST}" and http.request.uri.path eq "/api/contact")))`,
      action: 'block',
      ratelimit: {
        characteristics: ['ip.src', 'cf.colo.id'],
        period: 10,
        requests_per_period: 30,
        mitigation_timeout: 10,
      },
    },
  ],
}
