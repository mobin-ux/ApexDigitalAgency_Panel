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

## IN PROGRESS — Wallet & Credit (`wallet.vue`)  ⬅ NEXT ACTION

Two design zips received (in `C:\Users\mobin\Downloads\` — re-extract from there;
scratchpad copies die with the session):

- `Page redesign request Wallet.zip` → **`Apex Wallet & Credit.dc.html`** (843 lines, populated states)
- `Page redesign requestWallet (Empty).zip` → **`Apex Wallet & Credit Empty Pages.dc.html`**
  (843 lines) + `Apex Wallet & Credit-print-bor8bj.dc.html` (1,220-line print variant)

Status: zips extracted once, **spec NOT yet reviewed, nothing implemented**.
Plan when resuming: follow ADR-006 cadence — map sections/headings of both variants,
read the logic scripts (data model + states), implement `wallet.vue` covering
populated AND empty states, wire real APIs (`/api/finance/*`, transactions,
walletBalance/adCredits), GBP, lint, verify, update DESIGN_SYSTEM.md roadmap,
commit, push.

## Remaining queue (user sends a Claude Design zip per page)

1. **Wallet & Credit** — in progress (above)
2. Support / ticketing (`support.vue`) — design explicitly "being redesigned next"
   per the My Orders stub
3. Settings (`settings.vue`)
4. Auth pages (login-1 = active login, signup-1, recover)
5. Not yet designed at all: service *compare* view, invoices (see REQUIREMENTS §6)

## Known issues (open, non-blocking)

- **Hydration mismatch warnings** on every dashboard page — pre-existing, shared
  chrome (suspect color-mode/i18n), NOT page regressions. Fix once, globally.
- Preview **screenshots time out** on this machine — verify via `preview_eval` DOM
  checks + computed styles; curl + cookie jar for SSR auth paths.
- Broken dev seeds: `/api/seed-rich`, `/api/seed-wallet`, `prisma/seed.js`
  (schema drift). Working: `create-admin`, `seed-orders`, `seed-support`, `seed-notifs`.
- `.npmrc` registry mirror (runflare) 403s intermittently →
  `pnpm install --registry=https://registry.npmmirror.com/`.
- Legacy pages (wallet/support/settings/auth) still old-style: hardcoded hex, USD,
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
