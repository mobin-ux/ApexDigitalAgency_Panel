# MEMORY.md — Living project state

> Handoff doc for continuing work in fresh sessions. Update the relevant section
> whenever a page ships, a decision lands, or a blocker appears.
> Last updated: **2026-07-10** (context-externalization session).

## Where things stand

- Branch: `master` @ `4c1dc3d`, in sync with `origin/master`
  (github.com/mobin-ux/ApexDigitalAgency_Panel).
- Working tree: `prisma/dev.db` modified (local test data — never commit),
  `graphify-out/` untracked (generated — never commit).
- Stale branch `refactor/apex-dashboard` (local + origin) is superseded by master;
  deletable, but ask the user first.

## Done (implemented, verified, pushed)

| Commit | What |
|---|---|
| `cbd1ff7` | Foundation: brand tokens, sidenav cleanup, useCurrency, app.config |
| `d7793d5` | Auth fixes (reload-logout: useRequestFetch + swr:false), postinstall prisma generate, de-duplication |
| `51f1295` → `ee2b2cc` | Home/Balance page (interim rebuild, then Apex Design redesign + Yellix/violet token switch) |
| `ad12c8b` | New Order wizard (`services.vue`): 5 steps, financing calculator, e-signature, creates real orders |
| `4c1dc3d` | My Orders (`orders.vue`): list+detail, payment-plan rail, segmented installments; `/api/orders` now includes manager |
| _(this session)_ | **Wallet & Credit (`wallet.vue`)**: 4 tabs (Overview/Transactions/Installments/Banking) + top-up & apply-credit modals. Wired to `/api/finance/dashboard` (balance/cards), `/api/finance/transactions`, `/api/orders` (installments derived per ADR-010), real top-up via `POST /api/finance/deposit`. GBP throughout. Credit-line figures/auto-pay/invoices/bank details are TODO(api) placeholders. |

## Wallet redesign — gotcha to remember

The design's modals use CSS `@keyframes` (apexPop/apexFade), **not** Vue enter/leave
transitions. My first pass wrapped each modal in `<Transition>` with opacity leave
classes — the leave animated to `opacity:0` but Vue **never unmounted the node**,
leaving an invisible full-screen overlay that swallowed all clicks (close handlers
"did nothing"). Fix: drop `<Transition>`, use plain `v-if` + the `.apex-fade`/`.apex-pop`
classes. If a future modal "won't close," suspect a stuck Transition-leave first.

## Remaining queue (user sends a Claude Design zip per page)  ⬅ Support is NEXT

1. Support / ticketing (`support.vue`) — design explicitly "being redesigned next"
   per the My Orders stub
2. Settings (`settings.vue`)
3. Auth pages (login-1 = active login, signup-1, recover)
4. Not yet designed at all: service *compare* view, invoices (see REQUIREMENTS §6)

## Known issues (open, non-blocking)

- **Hydration mismatch warnings** on every dashboard page — pre-existing, shared
  chrome (suspect color-mode/i18n), NOT page regressions. Fix once, globally.
- Preview **screenshots time out** on this machine — verify via `preview_eval` DOM
  checks + computed styles; curl + cookie jar for SSR auth paths.
- Broken dev seeds: `/api/seed-rich`, `/api/seed-wallet`, `prisma/seed.js`
  (schema drift). Working: `create-admin`, `seed-orders`, `seed-support`, `seed-notifs`.
- `.npmrc` registry mirror (runflare) 403s intermittently →
  `pnpm install --registry=https://registry.npmmirror.com/`.
- Legacy pages (support/settings/auth) still old-style: hardcoded hex, USD,
  native alerts, Persian comments — normalize as each is redesigned.
- Prod-hardening backlog: httpOnly/secure cookie, real JWT_SECRET, gate seed
  endpoints (REQUIREMENTS §5).

## Open questions

- Backend for installments/credit-line/expenses/invoices (REQUIREMENTS §6) — build
  after the UI pass, or interleave? (User hasn't decided.)
- graphify knowledge graph: build was scoped (`.demo/app` + `.demo/server` +
  `layers/tairo`, code-only = free/local AST) but interrupted before extraction.
  Resume with `/graphify .` and re-select that scope if the user still wants it;
  partial artifacts sit in `graphify-out/`.

## Environment facts

- Dev login: `user@apex.com` / `user123` (customer), `admin@apex.com` / `admin123`
  — created by GET `/api/create-admin`.
- The user often runs their own dev server on **:3000**; agent preview uses
  `.claude/launch.json` (`demo`, autoPort) and must never kill the user's process.
- User-level auto-memory also exists at
  `~/.claude/projects/C--Users-mobin-Documents-apexpanel-ApexDigitalAgency-Panel/memory/`
  (project pointer, design decisions, spacing-fidelity feedback) — repo docs are the
  source of truth; keep both aligned on conflicts.

## How to resume in a fresh session

1. `CLAUDE.md` auto-loads (rules/conventions/commands).
2. Read this file for state; read `DESIGN_SYSTEM.md` §Roadmap for page status.
3. Deep-dive only as needed: `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`,
   `docs/decisions/ADR-*` (esp. ADR-006 workflow, ADR-010 placeholders, ADR-011 math).
4. Continue the IN PROGRESS item above.
