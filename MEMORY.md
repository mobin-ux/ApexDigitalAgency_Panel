# MEMORY.md — Living project state

> Handoff doc for continuing work in fresh sessions. Update the relevant section
> whenever a page ships, a decision lands, or a blocker appears.
> Last updated: **2026-08-18** (V2 redesign Phase 1 — shared shell).

## Where things stand

- Branch: `master`, in sync with `origin/master`
  (github.com/mobin-ux/ApexDigitalAgency_Panel). Latest: the admin-UI
  completion commit (projects/payments/tickets/settings/tools), on top of
  `b663292` (admin shell + overview + users) and the admin API surface
  (`ab93c5e`, `08c675e` — ADR-013).
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
| `10001f1` | Wallet & Credit (`wallet.vue`): 4 tabs (Overview/Transactions/Installments/Banking) + top-up & apply-credit modals. Wired to `/api/finance/dashboard` (balance/cards), `/api/finance/transactions`, `/api/orders` (installments derived per ADR-010), real top-up via `POST /api/finance/deposit`. GBP throughout. Credit-line figures/auto-pay/invoices/bank details are TODO(api) placeholders. |
| `67512ce` | Support (`support.vue`): 3 tabs (My tickets split-pane inbox+thread / New request / Help & FAQ). Wired to `/api/support/tickets` (list), `/api/support/[id]/messages` (full thread, fetched per-ticket), `/api/support/[id]/reply`, `/api/support/create`; project dropdown from `/api/orders`. Status/category/priority are free-text schema fields normalized via keyword matching (`catKey`/`priKey`/`statusKey`). Attachments (no upload endpoint/model), assigned-agent identity (no assignee field — renders as generic "Apex Support"), and FAQ copy are TODO(api)/static placeholders. |
| `2ef57b5` | Toolbar: breadcrumb nav + dividers added to the shared page header (`DemoToolbar.vue`). |
| _(prior session)_ | **Cross-cutting responsive audit**: fixed a shell-level bug where `sidenav.vue` padded only the toolbar, not `<slot />` — every page's content had zero guaranteed horizontal gutter and ran edge-to-edge below ~1200px width. Nested `<slot />` inside the toolbar's padded wrapper (one fix, every page inherits it). Also: wallet.vue Transactions-tab filter pills now scroll instead of wrapping into a two-row oval; services.vue success-modal footer buttons stack on narrow phones instead of cramming side-by-side. Full breakpoint audit against the user's checklist (containers, grids, typography, touch targets, overflow) across balance/orders/services/support/wallet — see DESIGN_SYSTEM.md §5 "Fixed" for the write-up. settings.vue/auth pages explicitly excluded (user confirmed) — still old-style, in scope only when their design zip arrives. |
| `c3f7f2b` | **Flagship-phone responsive pass**: safe-area/`dvh` handling (`viewport-fit=cover`, shell gutters `max(<gutter>, env(inset))`, support pane + wallet/services modals `100dvh - env(top/bottom)`); wallet installment rows reflow to two lines under `sm` (no overflow at 393px); top-up presets `grid-cols-2 sm:grid-cols-4`; DemoToolbar gains a `md:hidden` search icon (search had no <768px entry) + `min-w-0`/`truncate` breadcrumb (drops parent crumb <400px), large duplicate page-title removed. **Build-fix**: a literal `pt-[env(...)]` in a sidenav comment was scanned by Tailwind v4 → invalid `padding-top: env(...)` → lightningcss 500'd the whole dev server (Tailwind scans comments; document classes in valid form or prose). Verified 1440px + 393px, no h-overflow, layouts revert at ≥sm. |
| `08c675e` → `ab93c5e` | **Admin backend foundation (ADR-013)**: shared server utils (`auth.ts` requireAuth/requireRole/requireAdmin + cookie/token single-source, `validate.ts` zod body/query → 400 fieldErrors, `http.ts` pagination envelope, `audit.ts` + new `AuditLog` Prisma model); `/api/admin/{users,users/:id,stats}` exemplar endpoints (RBAC w/ DB-fresh role, whitelisted PATCH + before/after audit); ~25 customer routes refactored off inline JWT + per-file PrismaClient onto the shared utils (bad token now 401 not 500). Security fixes en route: deleted unauthenticated `/api/users` GET/POST; ticket-thread IDOR (read+reply were fully unauthenticated); `/api/orders/pay` IDOR + atomic conditional debit; `settings/get-all` password-hash leak; login enumeration + token-in-body; deposit now increments `walletBalance` (column drifted before); signup wrote schema-invalid `role:'USER'`/`name`/`status`; seeds fixed + dev-gated (404 in prod); JWT secret via `NUXT_JWT_SECRET` runtimeConfig. Verified via curl matrix (403/401/400/audit) + browser login/reload smoke. |
| `b663292` + _(this session)_ | **Admin panel UI — all 7 modules** on the same Apex design language (`layout: 'admin'`, `middleware: 'admin'`, tokens/Yellix/violet, GBP, toasts, apex-fade/pop modals per the wallet gotcha). Shell + shared components (`AdminPageHeader/StatTile/StatusChip/Pager/EmptyState/UserCell`), `/admin` overview, `/admin/users` (+ `[id]` detail: profile/role/suspend/company/wallet-adjust). This session added the remaining five: `/admin/projects` (directory w/ search/status/category/`?userId` deep-link filters + create-on-behalf modal w/ customer picker), `/admin/projects/[id]` (contract/status/progress/manager editing, milestone CRUD, files read-only, delete danger zone), `/admin/payments` (finance summary + 3 tabs: transaction ledger w/ once-only refunds, withdrawal approve/decline queue, read-only installments — no Project FK, ADR-010), `/admin/tickets` (split-pane inbox: triage status/assignee, staff reply vs amber internal notes — `isInternal` filtered from customer thread), `/admin/settings` (typed catalogue over key/value `Setting` rows, upsert + audit; UI states values only apply where features read them), `/admin/tools` (audit trail w/ expandable metadata, broadcast notifications, dev-only seed buttons). Verified: eslint clean; SSR smoke on :3111 — all 7 routes 200 w/ admin cookie, project detail renders milestones, customer gets 403 on admin APIs + bounced off `/admin/**` pages. (`nuxt typecheck` fails on this machine for env reasons: npx-cached vue-tsc ↔ typescript `ERR_PACKAGE_PATH_NOT_EXPORTED`, pre-existing, checks no files.) |

## Wallet redesign — gotcha to remember

The design's modals use CSS `@keyframes` (apexPop/apexFade), **not** Vue enter/leave
transitions. My first pass wrapped each modal in `<Transition>` with opacity leave
classes — the leave animated to `opacity:0` but Vue **never unmounted the node**,
leaving an invisible full-screen overlay that swallowed all clicks (close handlers
"did nothing"). Fix: drop `<Transition>`, use plain `v-if` + the `.apex-fade`/`.apex-pop`
classes. If a future modal "won't close," suspect a stuck Transition-leave first.

## V2 redesign — in progress  ⬅ CURRENT WORKSTREAM

The client is shipping a second-generation design from a Claude Design project
(`19ec9d54-4e35-471d-a590-b6280be241d3`), one phase at a time, each as a
`.dc.html` mockup **plus** a `PHASE-N-*.md` implementation spec. Read the spec
first — it is far more precise than the mockup and states the constraints.
Read it with the `DesignSync` tool (`method: get_file`).

| Phase | Area | Status |
|---|---|---|
| 1 | Shared shell | ✅ Done |
| 2 | Dashboard (`balance.vue`) | ✅ Done |
| 3 | New Order (`services.vue`) | ✅ Done |
| 4 | My Orders | ⬅ next |
| 5–9 | Wallet · Support · Settings · Auth · Mobile/Light | ☐ |

**Phase 1 shipped:** Apex brand mark (+ favicon/title), 44px nav rows with a
violet `color-mix` active tint, hairline sub-nav, one account dropdown with
initials avatar, top bar cut to search + notifications on a 76px band,
in-page breadcrumbs deleted, `ApexPageHeader`/`ApexSectionLabel` adopted on the
five redesigned customer pages, and 110 arbitrary radii normalised to the
16/12/full scale. Applied to **both** shells (customer + admin). Details and the
standing shell rules: DESIGN_SYSTEM.md §4.

Two long-standing bugs fell out of it — see "Known issues" below.

**Phase 2 shipped (dashboard):** every figure on `balance.vue` is now real.
The credit-line card renders the actual `CreditLine` record from
`/api/dashboard/stats` in four states instead of a hardcoded £12,500 limit
under an "Approved" chip. Expenses no longer contradict themselves: the
headline is the ledger total and the per-project breakdown renders **only when
the installment plans provably sum to it** (see the gotcha below). "How it
works" expands three real steps instead of firing a "your account manager has
been notified" toast. Promo cut to one chip, 16px radius, solid violet accent,
no dot-grid overlay, `+145%` labelled "Example result". One service badge, no
coloured left border on project rows, `+12% vs last quarter` deleted.

### Phase 2 gotcha — `installmentPlan.paid` is not ledger-backed

`Transaction` is the money-truth; `Installment.paid` is a counter that seeds
and admin adjustments can set directly. On the current dev DB they disagree
badly: plans sum to **£3,988** while `stats.totalSpent` (sum of negative
transactions) is **£1,730**. So the expense breakdown is gated on
`Math.abs(planTotal - ledgerTotal) < 0.01` and simply does not render when they
diverge — which is the case locally, so **the breakdown is invisible on this
machine and that is correct**. To make it render unconditionally, add a
ledger-derived per-project figure to `/api/dashboard/stats` (sum `Transaction`
rows grouped by owning project) and drop the guard; there is a `TODO(api)` on
the computed.

**Phase 3 shipped (New Order wizard):** two correctness bugs plus polish, all
in `services.vue`, no API change.

- **Plan prices contradicted the rail.** Cards priced every plan with
  `amort(base)` (the 24-month monthly) while the rail and contract used the
  chosen `term`. With `finance.enable-24mo-plans` **off**, `term` is forced to
  12, so Launch showed £113/mo on the card and £200/mo in the rail at the same
  time. Cards now lead with total project value and quote `from
  fromMonthly(base)`, derived from `cheapestTerm`; the rail says `FROM` with the
  same number until step 3, then `YOUR MONTHLY`. **Verified in both
  configurations** by flipping the admin setting: 24-on → card £113 = rail £113;
  24-off → card £200 = rail £200.
- **Native `<select>` submitted answers nobody gave.** `buildBrief()` had
  `?? f.options?.[0]`, so an untouched "Pages needed" was written into the brief
  as "1–3 pages". Now `BaseSelect` with a "Select an option" placeholder, no
  fallback, and unanswered fields omitted. Verified by intercepting the POST
  body: only the field actually filled in appears in `brief`.
- Also: header sub-line, step-4 recap banner deleted, dd/mm/yyyy text date
  (not `type="date"` — that renders in the *browser's* locale), per-field
  validation on blur, Draw/Type signature toggle, stray `✕` replaced with a
  signing rule, dead Continue button removed from step 5, and "work begins
  today" copy replaced everywhere with kickoff-on-signature (orders are created
  PENDING).

**Note:** `BaseSelect`'s trigger needs `bg-white/5! rounded-xl! border-white/10!`
to match the wizard's other inputs — Shuriken's `rounded` scale has no 12px step
and its input tokens are a different surface.

## Remaining queue (older, pre-V2)

1. Not yet designed at all: service *compare* view, invoices
   (admin panel — backend **and** UI — is done; see the Done table)

## Fixed in V2 Phase 1 (were long-standing)

- ~~**Hydration mismatch warnings** on every dashboard page~~ — the two offenders
  were both in `DemoToolbar`: the locale flag image and the `Ctrl`/`⌘` hint from
  the layer's `useIsMacLike()`, which resolves in `onBeforeMount` — *before* the
  hydration render — so SSR and the first client render disagreed. The flag is
  gone (language moved into the account menu) and the hint resolves in
  `onMounted`. Verified: clean console on `/dashboards/*`.
- ~~**Brand assets and Yellix 404'd**~~ — `.demo/app/public/` is not Nuxt 4's
  public dir (`<rootDir>/public` = `.demo/public` is), so nothing under it ever
  shipped. Yellix had been falling back to Inter *in production*. Moved to
  `.demo/public/`. **If you add a static asset, put it in `.demo/public/`.**

## Known issues (open, non-blocking)

- Preview **screenshots time out** on this machine — verify via `preview_eval` DOM
  checks + computed styles; curl + cookie jar for SSR auth paths.
- **`claude-in-chrome` `resize_window` doesn't actually resize the viewport here** —
  reports success (and `window.resizeTo`/OS unmaximize-then-resize don't help either)
  but `window.innerWidth` never changes from whatever the Chrome window already was
  (~1528×651 observed). Screenshots always come back at that size regardless of the
  width/height requested. So mobile/tablet breakpoints can't be visually verified via
  this tool on this machine — rely on Tailwind class analysis (deterministic) + SSR
  DOM structure checks via curl; desktop-width rendering can still be screenshotted
  fine for sanity checks.
- Broken dev seeds: `/api/seed-rich`, `/api/seed-wallet`, `prisma/seed.js`
  (schema drift). Working: `create-admin`, `seed-orders`, `seed-support`, `seed-notifs`.
- `.npmrc` registry mirror (runflare) 403s intermittently →
  `pnpm install --registry=https://registry.npmmirror.com/`.
- Legacy pages (settings/auth) still old-style: hardcoded hex, USD,
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
