# Architecture — Apex Digi Customer Dashboard

Full architecture with rationale. Decisions with long-term consequences have an ADR in
`docs/decisions/` (referenced as ADR-NNN). Living state is in `MEMORY.md`.

## 1. Stack & monorepo

| Layer | Tech |
|---|---|
| Framework | Nuxt 3 (compatibilityVersion 4), Vue 3 `<script setup lang="ts">` |
| UI kit | Shuriken UI (`<Base*>`), Tairo layout components (`<Tairo*>`) |
| Styling | Tailwind CSS v4, tokens in `.demo/app/assets/main.css` |
| Server | Nitro routes (`.demo/server/api/**`) |
| DB | Prisma 6 + SQLite (`prisma/dev.db`, schema `prisma/schema.prisma`) |
| Auth | `jsonwebtoken` + `bcryptjs`, cookie `auth_token` |
| i18n | `@nuxtjs/i18n`, `no_prefix` (en default; fr/es/de/ar/ja shipped by template) |
| Pkg mgmt | pnpm workspaces: `.demo`, `.app`, `layers/*`, `tairo-component-meta` |

**The live app is the `.demo` workspace** (ADR-001). `.app` is an empty shell; the root
`pnpm dev` script points at it — use `pnpm demo:dev`. The `layers/tairo` layer supplies
Tairo components and is extended by `.demo/nuxt.config.ts`.

## 2. Directory map (the parts that matter)

```
.demo/
  app/
    pages/dashboards/        customer pages (balance, orders, services, wallet, support, settings)
    pages/auth/              login-1 (active login), signup-1, recover — still template-era
    layouts/sidenav.vue      customer shell: nav, real user chip, sign out
    composables/             useUser.ts, useCurrency.ts, useNotifications.ts
    middleware/auth.ts       route guard (cookie → fetchUser → redirect to /auth/login-1)
    plugins/auth-load.ts     hydrates user state at boot (single plugin; duplicate removed)
    assets/main.css          @theme tokens + Yellix @font-face (SINGLE token source)
    public/fonts/yellix/     Yellix .woff (400/500/600/700/800)
    public/brand/            apex-icon.svg, apex-wordmark-dark.svg
  server/api/                Nitro endpoints (see §5)
  nuxt.config.ts             colorMode dark, routeRules, modules
prisma/schema.prisma         data model (see §4)
.claude/launch.json          preview config `demo` (port 3000, autoPort: true)
DESIGN_SYSTEM.md             design language + conventions + page roadmap (living doc)
```

## 3. Design system integration (ADR-002/003/004/006)

The client's **Apex design system** arrives as Claude Design export zips (each contains
the page `*.dc.html`, an identical `_ds/apex-design-system-*/` bundle with tokens +
Yellix fonts, and reference screenshots). Integration strategy:

- Bundle token *values* were folded into the existing Tailwind/Shuriken ramps in
  `main.css` — **not** imported as a parallel CSS system (ADR-002):
  - `primary` ramp = electric violet, 500 = `#7d53f2`, 600 hover = `#6c40e8`.
  - `muted` ramp = warm grays → navy ink: 800 card `#16252a`, 900 `#0c1719`,
    950 page `#0b1517`.
- Dark is the default color mode; light must keep working (ADR-003).
- Yellix (display) self-hosted, exposed as `--font-heading` → `font-heading` utility;
  Inter remains body (ADR-004).
- Each redesigned page is implemented as a Vue SFC that reproduces the `.dc.html`
  spec's structure/spacing/typography exactly, swapping inline hex for tokens and its
  mock data for real API data (ADR-006). GBP replaces the mocks' `$` (ADR-005).

## 4. Data model (Prisma) — relevant shape & gaps

- `User`: profile fields + `walletBalance`, `adCredits`; relations to projects,
  transactions, cards, installments, tickets, notifications.
- `Project`: `name, category, status (string: PENDING/IN_PROGRESS/COMPLETED/CANCELLED),
  amount, progress, startDate, deadline, userId, managerId?` + `milestones[]`, `files[]`.
- `Milestone`: `title, status (PENDING/CURRENT/COMPLETED), date?`.
- `Transaction`, `Card` (limits/used fields), `WithdrawalRequest`.
- `Installment`: **exists but unlinked** — `project` is a string name, no FK to Project.
  This is why per-project installment plans are presentation-derived (ADR-010).
- `Ticket` + `TicketMessage`, `Notification`, `PasswordResetToken`.

## 5. API surface (customer-relevant)

| Endpoint | Notes |
|---|---|
| POST `/api/auth/login` | sets `auth_token` cookie (7d), returns user |
| GET `/api/auth/me` | cookie → fresh user (id/email/names/role/avatar/adCredits) |
| POST `/api/auth/signup`, logout, reset-password-* | template-era, functional |
| GET `/api/dashboard/stats` | **rewritten**: raw numbers `{stats:{activeProjects, walletBalance, adCredits, totalSpent}, projects[]}` — no formatting server-side; had selected non-existent `Project.client` (crashed) |
| GET `/api/orders` | projects + milestones + files + **manager** (added: `{firstName,lastName,avatar}`) |
| POST `/api/orders` | contract: `{ title, category, budget }` → PENDING project + 4 default milestones (`description` intentionally omitted — not in schema) |
| POST `/api/orders/pay` | pays FULL project amount from wallet, activates PENDING project — **not** an installment charge; do not wire to per-installment "Pay" buttons |
| `/api/finance/*`, `/api/support/*`, `/api/settings/*`, `/api/notifications/*` | used by old-style pages; revisit per page redesign |
| GET `/api/create-admin`, `/api/seed-orders`, `/api/seed-support`, `/api/seed-notifs` | dev seeds. **Broken (schema drift): `/api/seed-rich`, `/api/seed-wallet`, `prisma/seed.js`** |

## 6. Auth flow (ADR-007/008)

1. Login sets `auth_token` (JWT, secret `process.env.JWT_SECRET || 'secret'`,
   httpOnly:false — dev convenience, tighten for prod).
2. `auth` middleware: no cookie → redirect `/auth/login-1`; else `fetchUser()`.
3. `useUser().fetchUser()` uses **`useRequestFetch()`** so the incoming request's
   cookies are forwarded during SSR — this is what keeps hard reloads logged in.
   Plain `$fetch` here re-introduces the logout-on-reload bug.
4. `routeRules['/dashboards/**'] = { swr: false }` — the template's `swr: 3600` cached
   the first unauthenticated render and served it to everyone (ADR-008). Never re-enable
   caching on authenticated, per-user routes. Template demo routes keep their swr.
5. `postinstall: prisma generate` in root package.json — without it every API route
   500s after a fresh install (ADR-009).

## 7. Frontend architecture — implemented pages

All customer pages: `definePageMeta({ layout: 'sidenav', middleware: 'auth' })`.

- **balance.vue** (home; `/` → `/dashboards/balance`): header, dismissible 0%-finance
  promo hero, Financial status (cash + credit line), Active work rows, service cards,
  Expenses breakdown. Real: wallet/projects/spent/active-count. Placeholders
  (`TODO(api)`): credit-line figures, expense split, service from-prices.
- **services.vue** (New Order wizard): 5 steps (Service → Plan → Payment → Details →
  Contract) + success overlay + sticky order-summary rail. Financing math per ADR-011.
  Data-driven per-service `formSchemas`; canvas e-signature (draw or type, gates
  submission with agreement checkbox); posts to `/api/orders`; `?service=` query
  preselect (aliases: development/dev→web, marketing/seo→mkt, design→uiux,
  branding/brand→brand).
- **orders.vue** (My Orders): list view (4-stat strip, filter tabs w/ counts, name/ID
  search, sort, card grid, skeletons, empty state) + detail view (progress ring R=36,
  milestone timeline done/active/todo, files, project summary, payment-plan rail with
  segmented installment viz ≤16 else bar, next-payment block amber when due ≤5 days).
  Installments presentation-derived (12-month split, paid ≈ floor(progress% × 12),
  never full while active); "Pay" routes to Wallet (ADR-010); "Message your team" →
  `/dashboards/support` (real page, not the design's stub).
- **Old-style pages awaiting redesign**: wallet.vue, support.vue, settings.vue,
  auth pages — still hardcoded hex/USD/native alerts; rebuild only on design arrival.

Shared UI vocabulary (see DESIGN_SYSTEM.md + CLAUDE.md): status accents
(`#22B07D`/`#F2C14E`/`#EC6453`/`#6EA8FE`), payment-state taxonomy
(paid/pending/due/ontrack), PM chip gradients, `APX-XXXX` order refs, shortId = first
8 hex of UUID uppercased.

## 8. Tooling & verification

- Preview: `.claude/launch.json` (`demo`, autoPort) — the user often runs their own
  server on :3000; never kill it.
- Screenshots time out in the preview browser on this machine (heavy blur/animation) —
  verify via `preview_eval` DOM checks + computed styles, and curl-with-cookie-jar for
  SSR auth paths.
- ESLint (@antfu): notable rules that bite — `style/max-statements-per-line: 1`,
  `style/no-mixed-operators`, `node/prefer-global/process`, perfectionist import sort.
- Registry: `.npmrc` points at an Iran-friendly mirror (runflare) that intermittently
  403s; use `pnpm install --registry=https://registry.npmmirror.com/`.

## 9. Known issues (technical detail)

- **Hydration mismatches**: every dashboard page logs "Hydration completed but contains
  mismatches" — pre-existing, in shared chrome (toolbar/color-mode), NOT page work.
  Candidate root causes: color-mode class stamping, i18n locale detection.
- Stale seeds (§5) reference removed schema fields (`name`, `status`, `client`, card
  fields).
- `auth_token` httpOnly:false + fallback JWT secret `'secret'` — acceptable dev-only;
  production hardening required (httpOnly, real secret, secure).
- Legacy pages carry Persian comments; convert to English on rewrite.
