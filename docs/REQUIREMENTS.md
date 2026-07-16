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
  JWT via `requireAuth(event)`; admin APIs use `requireAdmin(event)` with a
  DB-fresh role check (ADR-013). Bad/expired tokens → clean 401, never 500.
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
- No real payment processing exists — buttons must never pretend otherwise
  (ADR-010).

## 6. Data/API gaps that block requirement completion (backlog)

| Gap | Blocks |
|---|---|
| `Installment` has no FK to `Project`; no per-installment charge endpoint | real payment plans, "Pay" buttons, payment history accuracy |
| No credit-line model on `User` | real credit-line card on home page |
| No expense categorisation | real expense breakdown on home page |
| No invoice model/endpoint | invoices requirement (§1) |
| Unread-message counts per project | unread chips in My Orders list (designed, hidden) |
| ~~Broken seeds (`seed-rich`, `seed-wallet`)~~ fixed (schema-valid, dev-gated); `prisma/seed.js` still stale | realistic local test data |
| Admin UI pages (the `/api/admin/**` backend foundation exists — ADR-013) | admin panel front-end |
