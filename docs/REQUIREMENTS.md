# Requirements — Apex Digi Customer Dashboard

Source: the client's original brief (2026-06), the Apex design system bundle
(`readme.md` inside the design exports), apexdigi.co.uk, and decisions made during
implementation. Hard rules live in CLAUDE.md; rationale in docs/decisions/.

## 1. Business scope (original brief — the product must let customers…)

- [x] Register and manage their accounts *(template auth flow works; redesign pending)*
- [ ] Browse and **compare** available services *(browse = done via New Order; a
      compare view has not been designed yet)*
- [x] Submit new service orders (New Order wizard)
- [x] Purchase services through installment plans (0%/12-mo, 1%·24-mo — ADR-011)
- [~] Manage installment payments, payment history, invoices, all financial details
      *(My Orders payment-plan rail done; Wallet & Credit page = in progress;
      invoices not yet designed)*
- [x] Customize service packages (plan tiers + per-service detail forms)
- [x] View dynamic pricing: final price, down payment (£0), monthly amount,
      duration, financing breakdown, payment schedule
- [x] Complete and submit orders directly in the platform (e-sign → POST /api/orders)

## 2. The financing product (core differentiator — copy-accurate)

- **"0% Finance"**: 12-month interest-free instalments, **no upfront payment**
  ("£0 today. Your project starts immediately."), **no credit checks**.
- 24-month option: 1%/month (≈12%/yr) on the reducing balance — "lowest monthly".
- **No early-repayment fees.** Cancel free before work begins; started milestones
  are payable.
- First instalment collected **30 days after project start**.
- Signing the agreement moves the project straight to Started; e-signature =
  drawn on canvas OR typed full name, plus explicit terms checkbox.

## 3. Brand & content requirements

- Brand: Apex Digital Agency (apexdigi.co.uk, London/UK). Use supplied logo SVGs
  (`/public/brand/`), never redraw.
- Palette: electric violet `#7D53F2` + deep navy ink; Yellix display / Inter body
  (details: DESIGN_SYSTEM.md, ADR-002/004).
- Voice: confident, warm, benefit-led; "we" → "you/your business".
- **Sentence case** headlines; eyebrow labels short and uppercase-styled via CSS.
- **British spelling** (optimisation, personalise). Emoji only as eyebrow accents
  (👋 🔥), never in body copy or bullets.
- **Currency: GBP (£)** — ADR-005. Design mocks showing `$` are implemented as `£`.

## 4. Non-functional requirements

- **Responsive**: mobile → tablet → desktop; grids collapse (cards stack ≤ sm,
  2-col md, 3–4-col xl); rails stack under content on small screens.
- **Accessibility**: aria-pressed on selectable cards, aria-labels on icon buttons,
  role=list/listitem/tablist/progressbar where the design implies them, visible
  focus (`focus-visible` ring), `prefers-reduced-motion` guard on every custom
  animation, form labels tied to inputs.
- **Performance**: no external image/CDN dependencies at runtime (Unsplash images
  were replaced with gradient panels; fonts self-hosted); `font-display: swap`.
- **Maintainability**: tokens over hex; data-driven repetition; composables for
  shared logic; `TODO(api)` markers on every unbacked figure; English comments.
- **Consistency**: every page must read as the same product — the Apex design
  system is the single design language (user explicitly rejected improvised
  spacing/layout).

## 5. Security requirements

- Every customer page: `middleware: 'auth'`; every customer API route verifies the
  JWT via `requireAuth(event)`; **every admin API route uses
  `requireStaffPermission(event, '<permission>')`** — the coarse `Role` gate plus
  one of eleven staff permissions, both checked DB-fresh (ADR-013, ADR-016).
  Bad/expired tokens → clean 401, never 500; an insufficient role → 403 naming
  the roles that do hold the permission.
- **Six fixed staff roles** (Owner · Admin · Project manager · Support agent ·
  Finance · Read-only) over eleven permissions, defined once in
  `shared/permissions.ts` and imported by both the server guard and the admin UI,
  so the documented matrix and the enforced matrix are the same object.
- **Suspension ends a live session**: `requireRole` refuses a `SUSPENDED` account
  on the next request, rather than only blocking the next sign-in (sessions are
  stateless 7-day JWTs).
- **Privilege escalation is impossible at invite acceptance**: the role and email
  come from the `StaffInvite` row, never the request body, and the single-use
  token is claimed by a conditional update inside the account-creating
  transaction.
- Authenticated routes are never SWR/HTML-cached (ADR-008).
- Server APIs return raw data scoped to `userId` from the verified session — no
  cross-user data. Object access is ownership-checked (404 for "not yours").
- Every admin mutation writes an `AuditLog` row (actor, action, target,
  before/after metadata, IP) via `recordAudit()`.
- All request input is zod-validated server-side (`validateBody`/`validateQuery`).
- ~~Review `/api/create-admin` + `/api/seed-*` exposure~~ **done**: dev-only,
  404 in production builds. JWT secret now via `NUXT_JWT_SECRET` runtimeConfig.
- Remaining hardening backlog: httpOnly cookie (blocked on reworking the client
  auth middleware — ADR-013), rate limiting on auth endpoints, real mail
  provider for password reset.
- ~~No real payment processing exists~~ **superseded by ADR-015**: real rails
  are in place (Stripe / GoCardless / PayPal, sandbox-first). Security
  requirements that come with them:
  - **PCI DSS SAQ-A** — card data never reaches our servers, logs or DB; all
    entry happens in provider-hosted iframes/redirects. Moving to self-hosted
    card fields (SAQ-A-EP) is explicitly out of scope.
  - Webhook endpoints authenticate by **HMAC signature only**, verified in
    constant time against the **raw** body, with a 5-minute timestamp
    tolerance (replay defence) and unique-event-id dedupe.
  - Money moves exactly once: `settleIntent` claims each intent with a
    conditional update, so duplicate or racing webhooks cannot double-credit.
  - Live credentials are inert until `payments.live-mode` is enabled; with no
    credentials the mock rail is served rather than falling back to anything
    that could charge.
  - Provider secrets are server-only `runtimeConfig`; only publishable keys
    are exposed to the browser.

## 6. Data/API gaps that block requirement completion (backlog)

| Gap | Blocks |
|---|---|
| `Installment` has no FK to `Project`; no per-installment charge endpoint | real payment plans, "Pay" buttons, payment history accuracy |
| No credit-line model on `User` | real credit-line card on home page |
| No expense categorisation | real expense breakdown on home page |
| No invoice model/endpoint | invoices requirement (§1) |
| Unread-message counts per project | unread chips in My Orders list (designed, hidden) |
| ~~Broken seeds (`seed-rich`, `seed-wallet`)~~ fixed (schema-valid, dev-gated); `prisma/seed.js` still stale | realistic local test data |
| ~~Admin UI pages~~ **done** — all 7 modules at `/admin/**` (overview, users, projects, payments, tickets, settings, tools) on the `/api/admin/**` backend (ADR-013) | — |
| No mail provider: staff invites, password resets and notifications cannot be emailed. The invite panel hands the operator a link to pass on instead | a self-service invite flow; "check your inbox" copy that is literally true |
| ~~No `DeliverableRelease` model~~ **done** (ADR-017): releasing and withholding project files is real, the platform rule governs it, and the audit log's Files bucket is populated. **Still missing: an upload endpoint** — `ProjectFile` rows arrive by seed or direct record, so the agency cannot add deliverables from the panel | an uploader for project deliverables |
| Instalment pricing is fixed to 12 and 24 months (ADR-011), so the platform cannot offer the design's 3/6/36-month terms | a per-service term catalogue (Phase 9 Support & Catalogue, badge 21) |
