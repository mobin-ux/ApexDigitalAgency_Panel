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
