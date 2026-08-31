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
    layouts/sidenav.vue      customer shell: brand band, ApexSidebarNav, ApexAccountMenu
    layouts/admin.vue        admin shell — same components, ADMIN chip
    components/Apex*.vue     shared shell vocabulary (V2 Phase 1):
                             ApexSidebarNav, ApexAccountMenu, ApexNotificationsMenu,
                             ApexPageHeader, ApexSectionLabel
    composables/             useUser.ts, useCurrency.ts, useNotifications.ts
    middleware/auth.ts       route guard (cookie → fetchUser → redirect to /auth/login-1)
    plugins/auth-load.ts     hydrates user state at boot (single plugin; duplicate removed)
    assets/main.css          @theme tokens + Yellix @font-face (SINGLE token source)
  public/fonts/yellix/       Yellix .woff (400/500/600/700/800)
  public/brand/              apex-icon.svg, apex-wordmark-dark.svg
                             NOTE: the public dir is `.demo/public`, NOT
                             `.demo/app/public` — assets under the latter are
                             never served (they 404'd silently until 2026-08-18)
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
- **Staff access (ADR-016)**: `User.staffRole` (nullable string, one of the six
  roles in `shared/permissions.ts`) and `User.staffJoinedAt`. Additive and
  separate from `Role`, which still answers only "can this account reach the
  panel". `StaffInvite` (email, name, role, single-use token, 7-day expiry,
  `acceptedAt`/`cancelledAt`) — a record of who was asked, granting nothing.
- `AuditLog` gained `roleAtTime` and `reason`: the log has to say what was true
  when the action happened, and a role can change afterwards. Null on rows
  written before Phase 9, and rendered as absent rather than back-filled.
- **Deliverables (ADR-017)**: `DeliverableRelease` (project, file count,
  the outstanding balance *snapshotted at release*, reason, actor + role,
  `releasedAt`, and a `withdrawnAt` stamp rather than a delete) records
  who handed a project's files to the client and why. `ProjectNote` holds
  staff-only project notes — a separate model from `TicketMessage` on
  purpose, so internal text has no path into a customer thread.

## 5. API surface (customer-relevant)

**Server conventions (ADR-013)**: every Prisma-backed route uses the shared
utils in `.demo/server/utils/` — `requireAuth(event)` for customer routes and
**`requireStaffPermission(event, '<permission>')`** for every `/api/admin/**`
route (ADR-016; never inline JWT; bad tokens → 401, not 500), the `prisma`
singleton (never `new PrismaClient()`), zod `validateBody`/`validateQuery`
(400 with `data.fieldErrors`), and `recordAudit()` on every admin mutation. List
endpoints return the `paginated()` envelope `{items,total,page,pageSize,pageCount}`.
`requireAdmin` still exists as the coarse panel gate that
`requireStaffPermission` is built on, and `requireRole` now also refuses a
`SUSPENDED` account so withdrawing access ends a live session rather than only
blocking the next sign-in.
JWT secret: `runtimeConfig.jwtSecret` (`NUXT_JWT_SECRET` env override).

| Endpoint | Notes |
|---|---|
| POST `/api/auth/login` | uniform 401 (no account enumeration), sets `auth_token` cookie (7d, sameSite=lax, secure in prod), returns user — **token no longer in body** |
| GET `/api/auth/me` | cookie → fresh user; `{user:null}` for anonymous (client boot calls it unconditionally) |
| POST `/api/auth/signup` | zod-validated; always `role: CUSTOMER`; accepts firstName/lastName or single `name` |
| logout, reset-password-* | shared cookie util; reset always answers success (no probing) |
| GET `/api/dashboard/stats` | raw numbers `{stats:{...}, projects[]}` — no formatting server-side |
| GET `/api/orders` | projects + milestones + files + manager. **Files are gated (ADR-017)**: while a project's deliverables are held the file names and sizes are returned with a blanked `url`, so the gate is enforced here rather than in the template |
| POST `/api/orders` | `{ title, category, budget }` → PENDING project + 4 default milestones |
| POST `/api/orders/pay` | pays FULL amount, activates PENDING project — ownership-checked, atomic conditional debit (no double-spend). **Not** an installment charge (ADR-010) |
| POST `/api/finance/deposit` | writes ledger entry AND increments `User.walletBalance` (transactional — the column used to drift) |
| `/api/support/*` | ticket create/list zod-validated; thread read/reply **ownership-checked** (were fully unauthenticated) |
| `/api/settings/*` | schema-valid field names; `get-all` no longer returns the password hash |
| **`/api/admin/users`** (GET) | ADMIN only — paginated/searchable/role-filterable directory (`?page&pageSize&search&role`) |
| **`/api/admin/users/:id`** (GET/PATCH) | ADMIN only — detail w/ recent activity; whitelisted PATCH (role/adCredits/profile — not password/walletBalance/email) + audit row; self-demotion blocked |
| **`/api/admin/stats`** (GET) | `work.view` — the Overview screen: the four count tiles, the oldest-first work queue, the delivery pipeline, and the money card **only** for a role holding `money.view`. Every pre-existing field is still returned |
| **`/api/admin/projects/:id/deliverables/release`** (POST) | `work.release` — hands the files to the client. A reason is **required** while a balance is outstanding; the balance is snapshotted on the row. 409 if already released |
| **`/api/admin/projects/:id/deliverables/withdraw`** (POST) | `work.release` — stamps `withdrawnAt` on the active release with a conditional update, so racing withdrawals settle it once |
| **`/api/admin/projects/:id/advance`** (POST) | `work.assign` — completes the current milestone, lights the next, and recomputes `progress` from the timeline in one transaction and one audit entry |
| **`/api/admin/projects/:id/notes`** (POST) | `work.assign` — a staff-only project note. No customer endpoint reads `ProjectNote` |
| **`/api/admin/{projects,finance,tickets,settings,audit,milestones,notifications}`** | ADMIN only — full management surface (list/detail/create/patch/delete per module; finance = summary/transactions/refund/withdrawals/installments; tickets incl. internal notes + reply; settings key/value upsert; broadcast notifications). Same ADR-013 conventions: `requireAdmin`, zod, `paginated()`, `recordAudit()` |
| POST `/api/finance/topup` | **real gateway top-up** (ADR-015). Creates a `PaymentIntent` *before* calling the provider, returns redirect/clientSecret; the wallet moves only in `settleIntent`. Supersedes `/api/finance/deposit` for the UI |
| POST `/api/webhooks/:provider` | **the only unauthenticated writes** — the HMAC signature is the auth. Raw body → constant-time verify → unique `(provider, providerEventId)` insert → 200. `stripe`\|`gocardless`\|`paypal`\|`mock` |
| GET `/api/admin/payments/health` | ADMIN — rails status: configured providers + mode, trial balance, stuck intents, webhook failures, provider balances |
| **`/api/admin/team`** (GET) | `team.manage` — staff members (role ADMIN) with their `staffRole`, project load and most recent audited action, **plus** pending invites as a separate list (badge 24) |
| **`/api/admin/team/:id`** (PATCH) | `team.manage` — change `staffRole` or suspend/restore. Refuses self-edits and last-owner demotion/suspension with the sentence the UI shows; writes an audit row with the typed reason |
| **`/api/admin/team/invites`** (POST) | `team.manage` — create a `StaffInvite` (single-use token, 7-day expiry). Grants nothing. Returns the acceptance link, because there is no mail provider |
| **`/api/admin/team/invites/:id`** (DELETE) | `team.manage` — withdraw; stamps `cancelledAt` rather than deleting, so the audit trail's subject survives |
| **`/api/admin/team/invites/:id/resend`** (POST) | `team.manage` — mints a NEW token and restarts the clock, invalidating the previous link |
| GET `/api/auth/invite?token=` | unauthenticated by necessity (the invitee has no account). Returns only the offered name, address and role — never the token or the inviter |
| POST `/api/auth/accept-invite` | the **only** route that can create a non-CUSTOMER account. Role and email come from the invite row, never the body; the invite is claimed by a conditional update inside the account-creating transaction |
| GET `/api/create-admin`, `/api/seed-*` | **dev-only (404 in production builds)**. All seeds now schema-valid |

Deleted: `/api/users` GET/POST (were unauthenticated user list/create — superseded by `/api/admin/users`).

## 6. Auth flow (ADR-007/008)

1. Login sets `auth_token` via `setAuthCookie()` (JWT signed with
   `runtimeConfig.jwtSecret` — override with `NUXT_JWT_SECRET`; sameSite=lax,
   secure in prod; httpOnly:false until the client middleware stops reading
   the cookie — see ADR-013). Session guards live in `server/utils/auth.ts`:
   `requireAuth` (401), `requireRole`/`requireAdmin` (403, DB-fresh role).
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
- **Old-style pages awaiting redesign**: settings.vue, auth pages — still hardcoded
  hex/USD/native alerts; rebuild only on design arrival.
- **Admin — Team & platform (V2 Phase 9)**: `/admin/team` (staff, invites and the
  role matrix), `/admin/settings` rebuilt as the design's four platform panels
  with the rest of the catalogue below it, `/admin/audit` (the log, lifted out of
  Tools, with kind filters and CSV export). The sidebar is grouped Work · People ·
  Money · Service · System and renders a padlock — not a link that 403s — for a
  destination the signed-in `staffRole` cannot open. `/auth/accept-invite`
  completes the invite loop on the Phase 8 auth shell. See ADR-016.
- **Admin panel** (`/admin/**`): `layout: 'admin'` + `middleware: 'admin'` (role gate;
  non-admins → customer dashboard), swr:false, shared `Admin*` components. Seven
  modules — overview, users (+detail), projects (+detail w/ milestone CRUD), payments
  (ledger/refunds, withdrawal queue, read-only installments), tickets (split-pane
  triage, staff reply vs internal notes), settings (typed catalogue over `Setting`
  rows), tools (audit trail, broadcast, dev seeds). Same Apex design language as the
  customer pages.

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

## 9. Payment rails (ADR-015)

Real money infrastructure, provider-agnostic by construction.

```
.demo/server/payments/
  types.ts       PaymentProvider interface — the ONLY thing call sites import
  registry.ts    per-capability routing from Settings; live-mode safety gate
  service.ts     orchestration: startPayment / settleIntent / applyWebhookEvent
  ledger.ts      double-entry posting + trial balance
  client.ts      shared transport: timeouts, jittered retry, error normalisation
  stripe.ts | gocardless.ts | paypal.ts | truelayer.ts | mock.ts
```

- **Providers**: Stripe (cards/wallets/payouts), GoCardless (Bacs Direct Debit
  — the installment rail, fees capped at £4), PayPal (top-ups only),
  TrueLayer VRP (stubbed for the UKPI migration). No vendor SDKs: REST over
  `fetch` + `node:crypto`, so swapping a provider is one file.
- **Routing is per capability** (`charge`/`mandate`/`recurring`/`refund`/
  `payout`/`bank_link`) via `payments.provider.*` Settings. With no
  credentials the registry serves `mock`, so a missing key can never become
  a real charge. Live keys additionally require `payments.live-mode`.
- **Money**: integer minor units (`utils/money.ts`) throughout the payment
  models. The legacy `Float` pound columns are unchanged — conversion is
  explicit at the boundary.
- **Idempotency, twice over**: `WebhookEvent @@unique([provider, providerEventId])`
  rejects duplicate deliveries, and `settleIntent` claims the row with a
  conditional update so even *distinct* events settling one intent move
  money exactly once. Verified: 3 distinct events → 1 wallet credit.
- **Ledger**: every settlement posts a balanced journal
  (`USER_WALLET`/`PROVIDER_CLEARING`/`REVENUE`/`VAT`/`CREDIT_RECEIVABLE`/`FEES`).
  `PROVIDER_CLEARING` is what reconciliation compares against the provider's
  own balance.
- **PCI DSS SAQ-A**: card entry only ever happens in provider-hosted
  iframes/redirects. We store tokens and display metadata (brand/last4/expiry);
  `utils/logger.ts` Luhn-redacts anything PAN-shaped as a backstop.
- **Secrets** live in `runtimeConfig.payments` (server-only) with publishable
  keys under `public.payments`; `.env.example` documents every variable.

## 10. Known issues (technical detail)

- ~~**Hydration mismatches**~~ fixed 2026-08-18 (V2 Phase 1). Both causes were in
  `DemoToolbar`: the locale flag image and the `Ctrl`/`⌘` shortcut hint. The hint
  used the layer's `useIsMacLike()`, which resolves in `onBeforeMount` — before
  the hydration render — so the server said `ctrl` and the client's first render
  said `⌘`. Anything derived from `navigator` must resolve in `onMounted` (or sit
  inside `<ClientOnly>`), never earlier.
- `auth_token` httpOnly:false — the client route middleware reads the cookie via
  `useCookie`; flipping httpOnly requires reworking `app/middleware/auth.ts` to
  rely on `fetchUser()` alone (tracked follow-up, ADR-013). sameSite/secure and
  the runtimeConfig secret are already in place.
- Legacy pages carry Persian comments; convert to English on rewrite.
