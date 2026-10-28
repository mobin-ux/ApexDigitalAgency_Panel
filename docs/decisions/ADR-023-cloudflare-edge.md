# ADR-023 — Cloudflare in front of both apps, with the zone kept as code

**Status:** Accepted (2026-10-28); applied to the live zone only on the
user's go-ahead.
**Context:** `apexdigi.co.uk` has been on Cloudflare's nameservers since
before the site existed, but the zone held a single unproxied A record for
the apex and nothing for `panel.apexdigi.co.uk` — so the panel's public
name did not resolve, its origin certificate could not renew, and every
email link (`NUXT_PUBLIC_SITE_URL`) pointed at a dead host. The user asked
for the project to be connected to Cloudflare end to end: DNS, TLS,
caching, security rules, and the server and code kept in step with it.
The VPS runs Caddy in front of the panel (`:3000`) and the site (`:3100`);
Caddy holds Let's Encrypt certificates for every hostname.

## Decision

1. **Both hosts are proxied** (`apexdigi.co.uk`, `www`, `panel`), with
   SSL mode **Full (strict)**: the edge checks the origin's Let's Encrypt
   certificate on every connection, so there is never a clear-text or
   self-signed leg. Caddy keeps issuing those certificates by HTTP-01;
   Cloudflare proxies port 80 and exempts `/.well-known/acme-challenge/`
   from its HTTPS redirect, and the edge redirect rule for `www` excludes
   the same path. A Cloudflare Origin CA certificate was considered and
   not chosen: it would tie the origin to the proxy (the sslip.io preview
   hosts, which bypass Cloudflare, need a public CA), and Caddy's renewal
   already works.
2. **Caddy is the client-IP trust boundary.** Both apps key their rate
   limits and audit rows on the first `X-Forwarded-For` entry. Behind a
   proxy that header is whatever the previous hop sent, and Cloudflare
   *appends* to a client-supplied value rather than replacing it. So the
   Caddyfile (`deploy/Caddyfile`) trusts exactly Cloudflare's published
   ranges (`trusted_proxies static …`, refreshed weekly by
   `scripts/cloudflare-ips.sh` on the box), reads the visitor's address
   from `Cf-Connecting-Ip` only for those, treats every other request as
   its own client, and hands each upstream a single-address
   `X-Forwarded-For`. The apps did not change: the contract they already
   relied on ("the first entry is the client") is now true in both paths.
3. **Nothing is injected or rewritten at the edge.** The site sends a
   strict, nonce-based CSP per response and the panel its own headers;
   Rocket Loader, Email Obfuscation, Cloudflare Fonts, Bot Fight Mode's
   challenge script and the HTML-rewriting features are off, and no
   Transform rule adds or changes a header. Security headers stay the
   apps' responsibility, in the repository, where they are tested.
4. **HTML is never cached at the edge.** The panel's pages are per-user
   and the site's carry a per-request nonce. Cache rules bypass both hosts
   except the hashed build assets, processed images, the media library,
   fonts and brand files, which are cached with the TTLs the origin sets
   (`respect_origin`). `browser_cache_ttl` is "respect existing headers".
5. **Payment webhooks are exempt from everything at the edge.** They are
   signed, server-to-server POSTs with no browser behind them; a WAF rule
   skips the rate limit and the security level for `/api/webhooks/*`. The
   one free-plan rate-limiting rule is a flood guard on sign-in and
   contact writes, set well above the apps' own in-process limits, which
   keep deciding the real policy.
6. **The zone is code.** `deploy/cloudflare-zone.mjs` is the desired
   state; `scripts/cloudflare-apply.mjs` plans by default, writes only
   with `--apply`, leaves records it does not know and rules it does not
   own alone, reports each setting the plan lacks instead of stopping,
   and ends with what the public internet sees. The API token lives on the
   operator's machine only — never on the server, never in an env file,
   never in chat; the server needs no Cloudflare credential at all.

## Consequences

- Order matters: `bash scripts/ship-caddy.sh` first (validated on the
  server, reload, previous file kept), then `--apply --dns-only` so Caddy
  can obtain the missing certificates, then `--apply`. Proxying before the
  Caddyfile is in place would make every visitor one Cloudflare address to
  both apps.
- The preview hosts (`*.146-19-130-11.sslip.io`) stay direct; the origin
  IP is therefore still reachable by anyone who knows it. Locking the
  firewall to Cloudflare's ranges or turning on Authenticated Origin Pulls
  would close that and end the previews — a separate decision.
- Cloudflare's free plan caps request bodies at 100 MB; the media library
  accepts ten 10 MB files in one request, so a maximal upload must be split
  into two. Everything else (20 MB client uploads, 10 s provider calls) is
  well inside the limits.
- Resend's DNS records for the sending domain are added to the same zone
  by hand from Resend's dashboard (the script lists and leaves them); the
  mail keys (ADR-022) wait on that verification, not on the registrar any
  more.
