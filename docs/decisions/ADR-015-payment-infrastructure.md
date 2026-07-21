# ADR-015 — Real payment infrastructure: provider selection and abstraction

**Status:** Accepted (2026-07-21) — supersedes the "no real payment processing"
clause of ADR-010.
**Context:** the platform must move from wallet-only play money to real money:
gateways, bank linking, direct debit, installment collection, refunds, payouts,
reconciliation, webhooks, reporting, PCI compliance.

## 1. What the business actually needs

Apex Digi is a **UK agency** selling **GBP** service contracts of roughly
£1,500–£15,000, collected as **0%/12-month** or **1%/24-month** installment
plans (ADR-011). That shape — few customers, high ticket, long recurring
horizon, domestic — drives every choice below. It is *not* a high-volume
low-ticket ecommerce profile, so optimisation targets are: cost per recurring
collection, mandate durability, and failure/retry handling — not checkout
conversion at scale.

## 2. Provider comparison

| | Stripe | GoCardless | Adyen | PayPal | TrueLayer (VRP) |
|---|---|---|---|---|---|
| Cards + wallets | ✅ best-in-class | ❌ | ✅ | ✅ | ❌ |
| Bacs Direct Debit | ✅ | ✅ **specialist** | ✅ | ❌ | n/a |
| Recurring cost on £400 | ~£6.20 (1.5%+20p) | **£4.00 (capped)** | ~£6 | ~£12 | ~£0.20 flat |
| Recurring cost on £1,200 | ~£18.20 | **£4.00 (capped)** | ~£16 | ~£35 | ~£0.20 flat |
| Mandate UX | hosted, good | hosted, purpose-built | integrator-built | n/a | bank-app approval |
| Settlement | 3–7d (1% instant) | 3–5d (Bacs cycle) | configurable | 1–3d | **seconds** |
| Payouts to us | ✅ (+ Connect) | ✅ | ✅ | ✅ | ✅ |
| Bank account linking | ✅ Financial Connections | ✅ (mandate) | ⚠️ | ❌ | ✅ native |
| Onboarding effort | low | low | **high** (enterprise) | low | medium |

**Decisions:**

1. **Stripe = primary gateway.** Cards, Apple/Google Pay, one-off wallet
   top-ups, Setup Intents for off-session reuse, Financial Connections for
   bank linking, Radar for fraud, and hosted Checkout/Elements which keep us
   in **PCI DSS SAQ-A**. Breadth and developer surface make it the default.
2. **GoCardless = installment collection.** Its 1% + 20p **capped at £4** is
   the single biggest margin decision in this product: across a 24-month plan
   on a £10k contract, Bacs via GoCardless costs ~£96 against ~£440 on cards.
   Bacs mandates also survive card expiry/reissue, which is the dominant
   involuntary-churn cause on multi-year plans.
3. **PayPal = optional top-up rail.** SMB clients frequently insist on it.
   Orders v2 for wallet top-ups only — never for installments (no usable
   UK direct-debit equivalent, worst unit economics).
4. **TrueLayer = roadmap, adapter stubbed now.** UKPI/commercial VRP went live
   2 June 2026: instant Faster-Payments settlement, near-zero per-transaction
   cost, revocable by the payer in their banking app. This is where installment
   collection should migrate once Wave 1 ecommerce use cases mature. The
   adapter exists so that migration is configuration, not a rewrite.
5. **Adyen rejected** for now: enterprise contracting and Interchange++ only
   pay off at volumes far above this platform's, with materially higher
   integration and operational overhead.

## 3. No vendor SDKs — thin REST adapters

Every provider is integrated through its **official REST API** over `fetch`,
with HMAC webhook verification via `node:crypto`. We deliberately do **not**
install `stripe`, `gocardless-nodejs` or `@paypal/*`.

- The requirement is provider-agnosticism; a shared interface with per-provider
  REST adapters is strictly more replaceable than SDK-coupled call sites.
- All three providers sign webhooks with HMAC-SHA256, which Node does natively.
- The project's npm mirror 403s intermittently (documented) — three heavyweight
  SDKs is three install-time failure modes for zero architectural gain.
- If an SDK is ever wanted, it is a **single-file** change behind
  `PaymentProvider`; nothing outside `server/payments/<provider>.ts` knows.

## 4. The abstraction

```
server/payments/
  types.ts       PaymentProvider interface + shared domain types
  registry.ts    resolves the active provider per capability, from Settings/env
  ledger.ts      double-entry posting (the money source of truth)
  stripe.ts      cards, wallets, top-ups, refunds, payouts, Financial Connections
  gocardless.ts  Bacs mandates + installment collection
  paypal.ts      Orders v2 top-ups
  truelayer.ts   VRP — stubbed, capability-gated off
  mock.ts        deterministic test double; the default when no keys are set
```

Call sites (`utils/finance.ts`, wallet/withdrawal/order endpoints) depend only
on `types.ts`. Choosing a provider is a **Setting**, not a code path — so a
migration from GoCardless to TrueLayer for installments is an admin toggle plus
a mandate re-consent campaign.

## 5. Money representation

New payment/ledger models store **integer minor units (pence)**, not `Float`.
Float pounds cannot represent £225.95 exactly; compounded across 24 charges and
a reconciliation diff, it produces real breaks. `utils/money.ts` owns the
conversions. The legacy `Float` columns (`Transaction.amount`, wallet balance,
plan totals) are **not** migrated in this ADR — that touches ~40 call sites and
gets its own phase; the boundary converts explicitly at the payment layer.

## 6. Double-entry ledger

`LedgerEntry` rows are grouped by `journalId` and must balance
(Σ debits = Σ credits) per journal. Accounts: `USER_WALLET`,
`PROVIDER_CLEARING`, `REVENUE`, `VAT`, `CREDIT_RECEIVABLE`, `FEES`.

This is what makes **reconciliation** possible: our `PROVIDER_CLEARING` balance
must equal the provider's reported balance, and any divergence is an
enumerable list of unmatched intents rather than a mystery. The existing
single-sided `Transaction` model stays as the customer-facing activity feed.

## 7. Webhooks

One ingestion endpoint per provider under `/api/webhooks/<provider>`, all of
which:

1. read the **raw body** (Nitro `readRawBody`) — parsing before verifying
   breaks every signature scheme;
2. verify HMAC in **constant time** (`crypto.timingSafeEqual`) and reject with
   400 on failure, recording the attempt;
3. persist the event with `@@unique([provider, providerEventId])` — Stripe and
   GoCardless both guarantee *at-least-once* delivery with retries for up to
   72 hours, so **duplicate delivery is normal traffic**, not an error;
4. acknowledge **200 immediately**, then process. Handlers are idempotent and
   re-runnable from the stored payload.

Webhook routes are the only endpoints exempt from `requireAuth` — the signature
*is* the authentication. They are exempt from CSRF and must never trust any
field outside the verified payload.

## 8. PCI DSS posture — SAQ-A

Card data **never touches our servers, logs, or database**. All entry happens
in provider-hosted iframes/redirects (Stripe Checkout & Elements, GoCardless
Billing Request Flow, PayPal JS SDK). We persist only provider tokens and
display metadata (brand, last4, expiry) — no PAN, no CVV, ever.

This keeps Apex in **SAQ-A**, the lightest validation tier. Any future move to
self-hosted card fields would escalate us to SAQ-A-EP and is explicitly out of
scope. `utils/logger.ts` redacts anything resembling a card number as a
defence-in-depth backstop.

## 9. Secrets and environments

All credentials come from environment variables via `runtimeConfig` — never
committed, never client-exposed (only publishable keys go under
`runtimeConfig.public`). `.env.example` documents the full set. **Providers
start in sandbox/test mode**; `payments.live-mode` is a Setting that must be
flipped deliberately, and the registry refuses to hand out a live provider
whose secret is still a test key.

When no keys are configured the registry serves the **mock** provider so local
development and CI stay fully functional without credentials — and so a
missing key can never silently fall back to charging real money.

## Consequences

- ADR-010's "no real payment processing — buttons must never pretend" is
  superseded: buttons now do real work, against sandbox providers until the
  operator supplies live keys.
- The operator must create Stripe/GoCardless/PayPal accounts and supply their
  own sandbox credentials; the agent neither creates accounts nor handles keys.
- Reconciliation and financial reporting become possible for the first time.
- Provider migration is a Setting change plus re-consent, not a rewrite.
