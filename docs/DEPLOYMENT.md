# Deployment & go-live guide

Written for a non-specialist operator. Everything in the platform runs and is
testable **entirely on your machine** with no third-party accounts. This
document marks the exact points where that stops being true, and why.

---

## 1. What works right now, locally, with nothing configured

With no API keys at all, the app serves the **mock payment rail** — a
deterministic test provider that runs the *identical* code path as Stripe or
GoCardless. Same endpoints, same webhooks, same database writes, same
double-entry ledger. Only the outbound HTTP call differs.

That means these are already fully functional and verified locally:

- Wallet top-ups (payment intent → settlement → ledger → balance)
- Add / set-default / remove payment methods, card **and** Direct Debit
- Instalment plans, charging, lazy auto-pay
- Credit line: apply → admin approve → repay
- Refunds, webhook ingestion, idempotency, reconciliation figures
- The entire admin panel

**Nothing is a placeholder waiting for a key.** Adding credentials swaps the
provider; it does not activate dormant code.

Mock rail behaviour is driven by the amount's last two digits, so you can
exercise failure paths without a sandbox: `…01` declines, `…02` requires
extra authentication, `…03` stays pending (simulating Bacs clearing),
anything else succeeds.

---

## 2. Stage one — Stripe test mode (no deployment needed)

**When:** whenever you want to see real payment objects in a real dashboard.
**Needs from you:** one API key. **Needs hosting:** no.

1. Stripe Dashboard → Developers → API keys (make sure the **Test mode**
   toggle is on).
2. Copy the **secret key** (`sk_test_…`).
3. Paste it into `.env`:
   ```
   NUXT_PAYMENTS_STRIPE_SECRET_KEY=sk_test_...
   ```
4. Restart the dev server.

Confirm it took effect: sign in as an admin and open
`/api/admin/payments/health`. `providers` should now list `stripe` with
`mode: "sandbox"` instead of only `mock`.

A wallet top-up will now create a genuine PaymentIntent visible in your
Stripe dashboard. **No real money moves** — test mode uses test card numbers
(`4242 4242 4242 4242`).

> The publishable key (`pk_test_…`) is already in `.env`. It is public by
> design — it ships inside browser JavaScript on every Stripe integration.
> The **secret** key is the one that must never be shared, committed, or
> pasted into a chat.

---

## 3. Stage two — webhooks (still no deployment needed)

**When:** to confirm payments that complete asynchronously — bank debits,
3-D Secure, and any payment where the customer leaves and comes back.
**Needs hosting:** no, if you use the Stripe CLI.

Stripe must call *back* into the app, and it cannot reach `localhost` from
the internet. The CLI tunnels this for you:

1. Install the Stripe CLI (`scoop install stripe` on Windows, or download
   from Stripe's GitHub releases).
2. `stripe login`
3. `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. It prints a signing secret (`whsec_…`). Put it in `.env`:
   ```
   NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET=whsec_...
   ```
5. Restart the dev server. Leave `stripe listen` running while you test.

Without this, charges still work — only asynchronous *confirmations* don't.
The app refuses to process an unverified webhook rather than trusting it,
because an unverified webhook is an unauthenticated write to financial state.

---

## 4. Stage three — GoCardless sandbox (no deployment needed)

**When:** to test Bacs Direct Debit, the instalment collection rail.
**Needs from you:** a sandbox account. **Needs hosting:** no.

Sign up at `manage-sandbox.gocardless.com` — sandbox requires **no** business
verification. Then Developers → Access tokens → create one (`sandbox_…`), and
Developers → Webhook endpoints → create one with a secret you choose.

```
NUXT_PAYMENTS_GOCARDLESS_ACCESS_TOKEN=sandbox_...
NUXT_PAYMENTS_GOCARDLESS_WEBHOOK_SECRET=<the secret you set>
```

GoCardless webhooks **do** need a public URL, so either use a tunnel
(`cloudflared tunnel --url http://localhost:3000`) or defer this until you
deploy. Mandate setup itself works locally; only the activation callback
needs reachability.

---

## 5. When hosting genuinely becomes necessary

Deployment is required for exactly three things, and not before:

| Need | Why |
|---|---|
| GoCardless mandate activation callbacks | Their webhooks need a public HTTPS URL; unlike Stripe there is no first-party CLI tunnel |
| PayPal (if used at all) | Same — webhook verification is an API round trip against a public endpoint |
| Customers other than you | Obviously |

Everything else — including all Stripe testing — is doable on your laptop.
Do not deploy earlier than this.

---

## 6. Production checklist

The app **refuses to start** in production if the first two are wrong. That is
deliberate: a process running on a forgeable session secret is worse than one
that does not run.

- [ ] `NUXT_JWT_SECRET` — 32+ random bytes, not the dev fallback
- [ ] `NUXT_ENCRYPTION_KEY` — a *different* 32+ random bytes
- [ ] `NUXT_PUBLIC_SITE_URL` — your real HTTPS origin
- [ ] Every payment API key paired with its webhook secret
- [ ] HTTPS terminated (the session cookie sets `Secure` automatically outside dev)
- [ ] Provider webhook endpoints pointed at `https://<domain>/api/webhooks/<provider>`
- [ ] `payments.live-mode` in Admin → Settings — **leave OFF** until you
      intend to take real money. Live keys are inert without it.
- [ ] Move off SQLite. `prisma/schema.prisma` → `provider = "postgresql"`;
      no application code changes. SQLite has no concurrent writer support
      and will bottleneck under real traffic.
- [ ] Rate limiting is in-process. Behind more than one instance, each keeps
      its own counters, so the effective limit multiplies by instance count.
      Swap the store in `server/utils/ratelimit.ts` for Redis — the call
      sites do not change.

## 7. Going live with real money

1. Complete Stripe account activation (business details, bank account).
2. Swap test keys for live keys (`sk_live_…`).
3. Recreate webhook endpoints in live mode — **the signing secret differs**.
4. Turn on `payments.live-mode` in Admin → Settings.
5. Verify at `/api/admin/payments/health` that mode reads `live`.

Until step 4, live credentials are refused by the provider registry. This is
the last safety net between a misconfigured deploy and charging a real
customer.

## 8. PCI compliance

You are in **SAQ-A**, the lightest tier, because card details never touch this
application — they are entered inside Stripe's own hosted iframe. The database
stores provider tokens plus brand/last4/expiry, never a card number.

Keep it that way. Building your own card form would move you to SAQ-A-EP and
substantially more compliance burden.

---

## 9. The website CMS (ADR-021) — what a deploy needs

The panel became the content system for the public site on 2026-10-28
(commits `bbedafa` → `cc969a5`, nine gates). Nothing from it is deployed
yet, and it goes out together with the panel's Settings re-check commits
(`1d4c5ae`, `8ea3dcd`), which are also waiting. Deploy **the panel first,
then the site**: the site falls back to its code baseline when the panel is
unreachable, but a site built against the new content API talks to the old
panel for nothing.

### 9.1 Panel — schema

Back up the live database, then apply the additive SQL in
`docs/migrations/2026-10-cms.sql` (five new tables: `SiteDocument`,
`SiteRevision`, `SiteRedirect`, `SiteMedia`, `SiteMediaRef`, plus their
indexes), **and** the Settings re-check schema that is still pending
(`Attachment.avatarUserId`, `Session`, `TwoFactor`,
`User.sessionsValidAfter` — generate it with `prisma migrate diff` from the
live schema, as the Phase 9 deploy did). Copy `prisma/schema.prisma` to the
box afterwards so the two match. No backfill: every new table starts empty
and every new column is nullable or defaulted.

```bash
cp /opt/apex/prisma/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-cms
sqlite3 /opt/apex/prisma/dev.db < docs/migrations/2026-10-cms.sql
```

### 9.2 Panel — environment (`/opt/apex/.env.production`)

| Key | Value | Why |
|---|---|---|
| `NUXT_WEBSITE_SITE_URL` | `http://127.0.0.1:3100` | where the panel tells the site to drop its cache after a publish |
| `NUXT_WEBSITE_REVALIDATE_SECRET` | a long random string | the bearer the site checks; must equal the site's `NUXT_CMS_REVALIDATE_SECRET` |
| `NUXT_WEBSITE_MEDIA_DIR` | `/opt/apex/site-media` (owned by `apex`, outside the bundle) | the media library's files; the default `.data/site-media` is inside the deploy and would be swapped out |
| `NUXT_UPLOAD_DIR` | `/opt/apex/uploads` | client and ticket uploads (Panel v2) — already needed, still unset |
| `NUXT_ENCRYPTION_KEY` | a long random string | two-step secrets at rest (Settings re-check) |
| `NUXT_COMPANIES_HOUSE_KEY` | optional | the lookup button hides without it |

Generate a secret with `openssl rand -base64 48`. Paste it into both env
files and nowhere else.

### 9.3 Site — environment (`/opt/apex-web/.env`)

| Key | Value |
|---|---|
| `NUXT_CMS_URL` | `http://127.0.0.1:3000` (the panel, as this box sees it) |
| `NUXT_CMS_REVALIDATE_SECRET` | the same string as the panel's |

With `NUXT_CMS_URL` empty the site renders its code baseline and the
redirects, sitemap and settings come from the code too — that is the
rollback position. `scripts/ship-web.sh` already creates and `chown`s
`.data`, which is where the content snapshot (`.data/cms`) and the image
cache (`.data/ipx`) live.

### 9.4 Order of operations

1. Panel: backup, SQL, schema copy, env keys, `bash scripts/ship-bundle.sh`.
   Health check as today. The scheduler (`website:publish-due`, every
   minute) starts with the process — one `node-server` process, so one
   scheduler; do not run the panel under `node-cluster`.
2. Site: env keys, `bash scripts/ship-web.sh`. Check
   `curl -s 127.0.0.1:3100/robots.txt` lists `Disallow: /preview/`, and
   `curl -sI 127.0.0.1:3100/` carries a fresh CSP nonce per request.
3. Sign in as the owner, open **Website → Pages → Import current site
   content**. This reads the site's own `GET /api/cms/baseline` (so the
   new site must be live first) and creates one published document per
   page and piece of chrome (33 today); nothing the visitor sees changes
   until a document is edited and published. Until the import is done the
   site keeps rendering its code, which is identical.
4. Invite the people who will edit (**Team & access**, roles Editor /
   Publisher). An Editor lands on the Website overview, not the work queue.

### 9.5 Rollback

Both ship scripts keep `.output.previous`. Rolling the site back to a build
without the CMS loses nothing: the panel's documents stay in the database.
Rolling the panel back leaves the five tables in place (the old build
ignores them) and the site degrades to its baseline on its next cache
miss. Media files under `NUXT_WEBSITE_MEDIA_DIR` are never deleted by a
deploy.

---

## 10. Outgoing email (ADR-022)

The panel sends email through Resend, the provider the site's contact form
already uses; one API key from the same account can serve both apps.

### 10.1 Schema

Additive: the `MailMessage` table (`docs/migrations/2026-10-mail.sql`),
applied like §9.1 — back up, run the SQL, copy `prisma/schema.prisma` to
the box. Nothing to backfill.

### 10.2 Keys (`/opt/apex/.env.production`)

| Key | Value | Why |
|---|---|---|
| `NUXT_MAIL_RESEND_API_KEY` | from Resend → API keys | the only credential |
| `NUXT_MAIL_FROM` | `Apex Digital Agency <no-reply@apexdigi.co.uk>` | must be on a domain verified in Resend (DNS records at Cloudflare) |
| `NUXT_PUBLIC_SITE_URL` | `https://panel.apexdigi.co.uk` | links in emails are built from it; already needed by payments |

Set both mail keys together or neither. The startup check warns about a
half-set pair.

### 10.3 What happens while the keys are unset

Nothing is sent, and nothing pretends to be. Messages are still recorded
and shown as failed ("Mail is not configured") under **System → Email**;
invites hand the operator the link as before and say no email went; the
recover page says reset-by-email is unavailable; notifications stay in the
panel. **While `apexdigi.co.uk` is suspended at the registrar the sender
cannot be verified, so leave the keys unset until the domain is renewed.**

### 10.4 Turning it on

1. Verify the sending domain in Resend (it gives the DNS records to add).
2. Set the two keys, restart `apex`.
3. Sign in, open **System → Email**, press **Send a test email to me**. The
   row turns green with the provider's id once it is accepted.
4. Retry any failed invite or notification rows worth sending. Reset and
   verification rows cannot be retried (their links died with their
   tokens); the person asks for a new one.
