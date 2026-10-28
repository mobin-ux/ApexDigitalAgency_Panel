# ADR-022 — Outgoing email: Resend over REST behind a durable outbox

**Status:** Accepted (2026-10-28).
**Context:** the panel had no way to send email. Staff invites handed the
operator a link to pass on, password-reset links were printed to the server
console with the token in clear text, signup created a working account with
no verification, every notification was in-app only, and the website review
workflow could not tell a publisher a draft was waiting. The public site
already sends its contact form through Resend's REST API with no SDK
(ADR-018 §4). The user settled four choices on 2026-10-28: soft email
verification at signup, every in-app notification also emailed behind one
per-account switch, the three missing notifications added, and the invite,
reset and review flows emailed.

## Decision

1. **Resend, over REST, no SDK**, the same provider and the same call shape
   as the site (`web/server/utils/contact-mail.ts`). Configuration is two
   environment keys, `NUXT_MAIL_RESEND_API_KEY` and `NUXT_MAIL_FROM`; the
   reply-to address is the `general.support-email` Setting. Links are built
   from `NUXT_PUBLIC_SITE_URL`, the panel's own origin.
2. **Every email is a row first** (`MailMessage`): rendered at enqueue time,
   written inside the caller's transaction where one exists so a business
   change and its email commit together, then tried once right away and
   retried by the `mail:deliver` task every minute with a growing wait (1,
   2, 4, 8, 16, 32 minutes) and a cap of six attempts. Each attempt claims
   its row with a conditional update and holds no transaction across the
   network call, the same shape as the website scheduler (ADR-021).
3. **Sent means the provider said so.** A row is `SENT` only once Resend
   returned an id, which is stored. The `Idempotency-Key` on every attempt
   is the row id, so a retry of a message whose acceptance was lost in
   transit cannot deliver it twice.
4. **Unconfigured is a state the screens name, not a silent no-op.** With
   either key empty, rows are still recorded and marked `FAILED` with "Mail
   is not configured"; `/api/config` carries `features.mail`, so invites
   hand over their link and say so, the recover page says reset-by-email is
   unavailable, and the Email screen names the two keys. Nothing anywhere
   says "emailed" unless a row says `SENT`.
5. **One structured shape for every template** (`heading`, `paragraphs`,
   one `action`, `footer`), rendered to plain text and a minimal escaped
   HTML by one renderer. Templates never write markup, and an action must be
   an absolute http(s) link.
6. **Bodies are never shown to staff.** A reset or invite email carries a
   live token, so the admin endpoint returns status, attempts and the
   provider's reason, never the text or HTML; the dev-only
   `GET /api/_test/mail` is how the test suites read a link from a message,
   and it does not exist in a production build. Log lines carry ids only.
7. **The Email screen** (`/admin/mail`, `team.manage`) is where a failure is
   seen and retried. A reset or verification email is not retryable: its
   link died with its token, and the row says so instead of offering a
   button that would send a dead link.

## Consequences

- Delivery needs a sender on a domain verified with Resend. Until the
  Resend records are in the Cloudflare zone (ADR-023) that is not done, so
  production runs with the keys unset and degrades as in (4).
- One `node-server` process runs one scheduler; a second would be harmless
  because of the claim and the idempotency key, but is not the design.
- Phone-only accounts have no address: they get no email, no verification
  banner, and the Settings page says why.
- Every in-app notification becomes an email for accounts that leave the
  switch on. A broadcast to every customer becomes one row each and drains
  at fifty a minute.
