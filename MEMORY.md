# MEMORY.md — Living project state

> Handoff doc for continuing work in fresh sessions. Update the relevant section
> whenever a page ships, a decision lands, or a blocker appears.
> Last updated: **2026-08-26** (V2 Phase 1 Mobile — shared shell at 393px, shipped).

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
| 4 | My Orders (`orders.vue`) | ✅ Done |
| 5 | Wallet & Credit (`wallet.vue`) | ✅ Done |
| 6 | Support (`support.vue`) | ✅ Done |
| 7 | Settings (`settings.vue`) | ✅ Done |
| 8 | Auth flow | ✅ Done |
| 9 | Mobile & light theme | 🚧 Light conversion still outstanding |
| 1M | Shared shell at 393px (`PHASE-1-MOBILE.md`) | ✅ Done |

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

**Phase 4 shipped (My Orders):** two data-truth fixes plus chrome.

- **Stat strip read 0 · 0 · £x · 0** on an account with nine projects: two
  tiles counted statuses nobody had yet, and "Payments due soon" filtered on
  `status === 'active'` so it could never fire for a pending project. Now three
  tiles that always carry a number — total projects, outstanding across open
  plans, soonest payment (£600 · today on this data).
- **Payment state was derived from project status.** A PENDING project with
  five paid installments showed "First payment · 0/24" on the card and a
  "Not started" chip beside "£1,130 of £5,424" in the rail. New `payState()`
  derives from `paid`/`total`, and card + chip + pending note all read from it.
  Verified on `P1 Verify Order`: chip now "Up to date", card "Next payment ·
  5/24", pending note correctly absent.
- Also: native sort `<select>` → `BaseSelect` (44×200, dark popup); "Details ›"
  text removed from the card button; card `aria-label`; `role="tab"` → aria-pressed
  buttons (there was no tabpanel); ring `aria-hidden`; MILESTONES / PROJECT
  SUMMARY use `ApexSectionLabel`; "Not started" → "Awaiting kickoff"; the active
  milestone sub-line only shows when the project itself is active; relative due
  dates say "today"/"tomorrow" instead of "in 0 days".

**Phase 4 gotcha — legacy 12-month fallback.** `deriveInst()` hardcodes a
12-month term for projects with no `installmentPlan` row, while real plans can
be 24. The same account therefore shows `x/12` on legacy projects and `x/24` on
new ones. Backfill plans for pre-migration projects to retire the fallback;
there is a `TODO(api)` at the top of `orders.vue`.

**Phase 5 shipped (Wallet & Credit):** one file (`wallet.vue`), no API
change. Three things on the page were saying more than the data supported.

- **Invoice numbers were minted in the template.** The invoices card built
  `INV-2026-${14 - i}` from the array index — the same number for every
  customer, and a *different* number for the same charge once a newer one
  arrived. There is no `Invoice` model. The card is now **Receipts**: the
  ledger rows themselves, with no number, no non-functional "Download" button,
  and a footnote that VAT invoices are emailed.
- **The credit section only had an active state.** An account with no
  `CreditLine` still got the full layout, so "£0 available" read as a spent
  facility rather than an absent one. Now gated on `hasCredit` with a real
  empty state. Going past the limit had its own dead end: "Start a project"
  was disabled with no explanation — the button is live again and an amber
  note says the limit is fully committed and that paying an installment frees
  credit up.
- **Transaction types were labelled by string surgery.** `AD_CREDIT` rendered
  as "Ad_credit". A `TX_LABEL` map covers all eight types.

Also: `comingSoon()` deleted from the page (billing "Edit" now links to
Settings); plan headers are `<button aria-expanded>` instead of
`div[role=button]` with hand-rolled key handlers; tabs match Phase 4's
`aria-pressed` choice (`role="tab"` with no tabpanel is a promise of
structure that isn't there); installment segments only render per-installment
up to 12, a single bar beyond; bank-transfer copy points at My orders for the
project ID; radius/spacing normalised to the Phase 1 scale (`rounded-[28px]`
→ `rounded-2xl`, `gap-[18px]` → `gap-5`, `px-6 py-[22px]` → `p-6`),
leaving one documented `rounded-[3px]` on a sub-8px progress bar; container
`1160px` → `1180px`; 24-month copy behind `enable24mo`.

Verified at 1280px and a true 375px: zero horizontal overflow on all four
tabs, zero native selects, zero tab roles, four `aria-pressed` buttons,
h1 30px, receipts show real ledger descriptions/dates/amounts with no
`INV-` string anywhere, expand toggle flips `aria-expanded`, clean console
on a fresh tab. ESLint clean; all six customer routes still SSR 200.

### Phase 5 gotcha — `ensureCredit()` overwrites admin limit changes

`server/utils/credit.ts` recreates/normalises every customer's `CreditLine`
on each dashboard load from Setting `credit.max-limit` (default £20,000), and
derives `used` from outstanding principal rather than maintaining it
incrementally. An admin "adjust limit to 0" therefore does not stick. To
exercise the no-credit UI, set `credit.max-limit` to 0, verify, then restore
it — that is how the empty state was tested here.

### Phase 5 note — wallet is dark-only, and that is Phase 9's problem

`wallet.vue` carries ~46 literal `text-white` classes with no light pair, so
12 elements across Overview and Banking render white-on-white when the OS
prefers light. Measured identical at the pre-Phase-5 commit, so Phase 5 left it
exactly as found; the V2-rebuilt pages (balance/orders/services) are already
clean. Fixing it means inventing a light palette for a page whose light
treatment has never been designed — that is Phase 9.

**Phase 6 shipped (Support):** `support.vue`, plus one editorial string in
`server/utils/catalog.ts` and one new custom property in `main.css`. No API
change — the reply body is still `{ content }`.

- **The composer accepted files and threw them away.** A working picker showed
  chips, then `sendReply()` posted `{ content: text }` and cleared them: an
  interaction indistinguishable from success. Same on the New Request drop
  zone. `TicketMessage` has no attachment relation and there is no upload
  endpoint, so the spec offered two honest resolutions and the mockup's own
  default (`attMode: "interim"`) picks the frontend one. Both composers now
  carry a note saying we'll reply with a secure upload link; `draftFiles`,
  `nFiles`, both `<input type=file>`, `formatSize` and the six handlers are
  gone. **Option A (ship `POST /api/support/:id/attachments` + an attachment
  relation) is still the better end state** — it is the uploads phase of the
  plan file — but it is a schema migration, and this phase was scoped to keep
  the backend intact.
- **The FAQ described the feature that doesn't exist** ("Attach files directly
  to any support conversation"). Rewritten in `DEFAULT_FAQ`. Note it is a
  Setting-backed default, so an environment with a `support.faq` row already
  written keeps its own copy.
- **The unread dot never went out.** `unread` was `messages[0]?.isAdmin` —
  "staff spoke last", true forever. Now compared against a per-ticket last-read
  timestamp in `useLocalStorage('apex:support:lastRead')`, with an
  `aria-label`. Marking read follows visibility, not selection: below `lg` the
  detail pane is hidden until a row is tapped, so the auto-selected ticket is
  not marked read there.
- **"First reply —" flickered** before the lazily fetched thread landed; a
  skeleton renders while `threadLoading`, so "—" now only means "no reply yet".
- **The empty state hardcoded "within 15 minutes"** beside a header pill
  reading `replyEta` from config. Both read config now.
- **The shell offset was a magic number in the page.** `.apex-pane-h`
  subtracted a literal `109px`; Phase 1 changing the bar from 56px to 76px is
  exactly how that kind of number goes stale. Now `--apex-shell-offset` in
  `main.css`, consumed by the page's `calc()`.
- Also: the last two native `<select>` in the V2 customer pages became
  `BaseSelect` (dark portal, 44px triggers); tab strip → `aria-pressed`
  (matching Phases 4–5); FAQ accordions → `aria-expanded`; reply textarea
  labelled; Subject/Message got `<label for>` and the priority buttons got
  `role="group" aria-label="Priority"`; `ticketRef()` defines the `#XXXXXXXX`
  format once; a comment records that `catKey()`'s substring precedence is
  deliberate; the dead `const toaster` (unused since before this phase) removed.

Verified: unread dot appears on a staff-replied ticket, clears on open, stays
cleared across reload, and re-lights after a *new* staff reply (exercised with
the real admin reply endpoint). Thread-fetch delayed to catch the skeleton →
skeleton then value, never a bare "—" mid-load. Category popup renders
`rgb(11,21,23)` with light options, not an OS menu. Reply still posts
`{"content":"…"}` and appends a bubble. Zero horizontal overflow at a true
375px on all three tabs with the composer above the fold; `.apex-support` top
measured 109px and 109 + pane height = viewport exactly. Light theme measured
identical to HEAD (1 / 2 / 2 low-contrast elements, same ones — pre-existing,
Phase 9). ESLint clean, console clean on a fresh tab, all six customer routes
SSR 200.

### Phase 6 gotcha — dev seeds can't authenticate

`/api/seed-support` verifies with `process.env.JWT_SECRET || 'secret'` while
login signs with `runtimeConfig.jwtSecret`, so a perfectly valid session gets
`invalid signature` and a raw 500. Pre-existing and dev-only; left alone
because this phase was not to touch server auth. To make support test data,
use the real endpoints: `POST /api/support/create` as the customer and
`POST /api/admin/tickets/:id/reply` as the admin.

**Phase 7 shipped (Settings):** `settings.vue` rewritten (834 → ~800 lines),
plus two additive fixes in `server/api/settings/update-all.put.ts`. This page
had never been refactored onto the Apex system — indigo `#6366f1` about forty
times, its own surfaces, 32–40px radii, `font-light` headings — and three of
its problems were losing customer data.

- **Fields were collected and thrown away.** Preferred name, family status,
  birthday, gender, legal address, socials and bio were all rendered, but the
  load path read back only `city` and `country`: fill them in, save, reload,
  gone — and the next save wrote empty strings over whatever was stored. The
  page now renders **only** what `get-all` returns and `update-all` persists.
  Removing the rest is non-destructive because `update-all` writes each column
  with `?? undefined`, which Prisma skips (checked before relying on it).
- **The company `create` branch dropped half its input.** `upsert`'s create
  took only name/email/website/phone/type, so a customer with no company row
  lost VAT number, address and notes on their *first* save and had to type
  them again. Found while testing, fixed to mirror `update`, verified on a
  brand-new account.
- **`Company.address` was never written.** The column has always existed;
  `update-all` simply omitted it, which is why Wallet's "add your billing
  address in Settings" pointed at a field that did not exist. Two additive
  lines (zod + upsert), no migration.
- **Four third-party image services shipped to customers.** `i.pravatar.cc`
  served a photo of a real, random person as the customer's own avatar;
  `img.logoipsum.com` as their company logo; an Unsplash hotlink as the cover;
  a Vercel demo SVG as page noise. All leaked IP + user-agent on every view.
  Initials for both marks now, no cover, no texture.
- **Avatar upload was broken, not just wasteful.** It read the file into a
  base64 data URL and PUT it inside the settings JSON — and `avatar` is capped
  at 500 characters by the endpoint's schema, so *any* real photo 400'd the
  whole save. Confirmed with curl. Removed rather than shipped disabled.
- **Sessions were invented.** One hardcoded MacBook in New York on
  `192.168.1.1`, identical for every customer, with `revokeSession(id) {}`
  behind the X. Now this browser only (resolved in `onMounted` — it reads
  `navigator`), plus a plain statement that there is no device history yet.
- **Password is its own action.** The old flow PUT the profile, *then*
  compared the confirm field, so a typo produced an error toast on a save that
  had already partly succeeded. Separate form, own button, all validation
  before any request (verified: zero requests fire on invalid input).
  Minimum is 8, matching signup — note the server still allows 6, and the
  seeded dev password `user123` is 7 characters, so it can no longer be *set*
  through this UI.
- **Copy corrected against reality.** The mockup says changing your password
  signs you out of other devices. It does not: sessions are stateless 7-day
  JWTs and rewriting the hash does not invalidate them. The page says what
  actually happens.
- Also: UK legal forms replace the US size bands (`LLC` isn't a UK thing), and
  the address heading follows the type — "Registered office address" for
  incorporated, "Business address" for sole traders; income / employees /
  manager / status removed from customer control; `twoFactor` dropped for an
  honest "Coming soon"; the Billing tab's hardcoded `INV-001 · $29.00` replaced
  by VAT + values *derived* from the company record + a link to Wallet; the
  scoped CSS that **redefined Tailwind's `.hidden`** (breaking every
  `hidden md:block` on the page) deleted; Save disabled until dirty and Discard
  actually wired; `role` no longer posted; `onMounted`+`$fetch` → `useFetch`.

**Not built, because the columns don't exist:** company number (+ its CRN
validator), trading name, structured UK address (line 1/2, town, county,
postcode) and therefore live postcode validation, a separate billing address,
avatar/logo upload, real sessions, 2FA. Rendering inputs for any of them would
recreate the write-then-lose defect this phase removed. They need a migration.

Verified: dirty-tracking on/off and Discard restore; a save posts only
round-tripped keys with no `role` and re-disables the button; type `ltd`
round-trips and flips the heading to "Registered office address" with the
Companies House hint; VAT shows neutral/valid/specific-invalid states and
accepts lowercase and spaced input; password blocks all three invalid cases
with zero requests, then a real change + revert succeeded; no MacBook, no
`192.168`, no toggles, "Coming soon" present; `.hidden` is `display:none`
again; every input has a label; zero horizontal overflow at 375px in all four
sections; zero native selects left anywhere in the customer panel. Light theme
measures **better** than HEAD (0/1/0/0 vs 0/2/0/1) after fixing one regression
this phase introduced — a `text-white!` Discard button that rendered white on
BaseButton's white light-mode background. ESLint clean, console clean on a
fresh tab, all six customer routes SSR 200.

### Phase 7 gotcha — `BaseSelect` has no empty-value item

`<BaseSelectItem value="">` renders a blank trigger: the underlying listbox
reserves the empty string for "no selection". Use the `placeholder` prop
instead (New Order does the same).

## Production deploy — 2026-08-19 (Phases 1–7 live)

Phases 1–7 are deployed to the VPS and serving at
https://146-19-130-11.sslip.io (also panel.apexdigi.co.uk). Deploy is now
**SSH-key only** — `~/.ssh/apex_deploy` is authorised on the box, so
`bash scripts/ship-bundle.sh` needs no password. See [[deployment-vps]].

**Two Windows-build gotchas cost the first attempt** (it 500'd and the script
auto-rolled-back; production never served it):

1. **Nitro's absolute symlinks.** Traced server deps are deduplicated into
   `server/node_modules/.nitro/<pkg>@<ver>/` with the real package names
   symlinked at them using **absolute** paths from the build machine. `tar`
   stored the links, they dangled on Linux, and the first render died with
   `ERR_MODULE_NOT_FOUND: Cannot find package 'hookable'`. Fixed with `tar -h`
   (`c7e2605`). 23 packages were affected.
2. **`better_sqlite3.node` ships as a Windows DLL** → `invalid ELF header` in
   the journal. It belongs to `@nuxt/content` (the Tairo docs), whose routes
   are **404 in production**, so it is inert noise — not a regression, and the
   content module was already failing on the previous build for a different
   reason. `ship-bundle.sh` now lists non-ELF `.node` addons after a
   successful deploy. The Prisma engine remains a hard gate.

**Verified live after deploy:** `/auth/login-1` and `/auth/signup-1` 200;
`/` 307; `/dashboards/**` and `/admin` 302 to login when anonymous; a
bad-credential POST to `/api/auth/login` returns 401, which proves Prisma is
running real queries against the production DB with the Linux engine. Phase 6
and Phase 7 chunks confirmed present in the live `.output`. Stripe keys in
`.env.production` survived untouched (live keys, verified by type+length only).

**Production DB is real** — 5 users, and `Company.address` (which Phase 7 now
writes) exists in the live schema; checked before deploying. Dev seed logins
(`user@apex.com`) do **not** exist there, so authed pages cannot be smoke-tested
from here without real credentials.

**Still outstanding:** the VPS's `.demo/nuxt.config.ts` build fixes are on the
box but not in the repo, and the root password (pasted in chat long ago) should
be rotated now that key auth works.

**Phase 8 shipped (Auth):** new `layouts/auth.vue`; `login-1`, `signup-2` and
`recover` rewritten onto it; `/auth` turned into a redirect and four demo
pages deleted; two new `/legal/*` routes; one line of `nuxt.config.ts`. The
auth endpoints are untouched.

- **Five Tairo demo auth pages were publicly reachable.** `/auth` — the most
  guessable auth URL — served a demo that told the visitor the password was
  `"password"`, faked a 4s submit and pushed to `/dashboards` without
  authenticating. Deleted `login-2`/`login-3`/`signup-1`/`signup-3`, made
  `/auth` redirect, and delisted them from `layouts/default.vue` and
  `collapse.vue` (which also listed `/auth/forgot`, a route that never existed).
- **The login error banner was a sibling of the full-screen layout**, above it,
  so a failed sign-in pushed the whole page down — and the same sentence also
  fired as a toast. Now one `role="alert"` inside the form column. Verified:
  the brand panel's top stays at 0 across a failure.
- **Three dead social buttons** (Google/X/LinkedIn — no handler, no provider,
  no route) and the "OR" divider removed; **"Trust for 60 days"** removed
  because the value was never sent.
- **Signup now asks for a name.** The endpoint already accepted `name`; the
  page never sent one, which is why the dashboard greeted people by their
  email local part. Verified end to end: signing up "Jane Okafor" stores
  `firstName: Jane`, `lastName: Okafor`.
- **The Terms link was inside the checkbox.** Clicking it toggled consent
  instead of opening the document — which was `href="#"` anyway. Box and
  sentence are siblings now; verified a click navigates to `/legal/terms`.
- **"Check your console/email"** replaced with the address, the real
  60-minute expiry, a spam note and a working resend, keeping the neutral
  "if an account exists" phrasing. `<ClientOnly>` removed (query params are
  available during SSR), so no more "Loading..." flash.
- **A completed reset now confirms before redirecting.** It does *not* claim
  other sessions ended — `reset-password-confirm` only rewrites the hash and
  burns the token, so the mockup's "signs you out everywhere else" would be
  false (same finding as Phase 7).
- **"Back to Home" pointed at `/dashboards`**, behind the auth guard, so from
  sign-in it looped back to sign-in. It goes to the marketing site.
- One password minimum (**10**) across signup, reset and Settings; strength
  meters on both new-password fields; show/hide toggles everywhere; identifier
  autofocus; `type="email"` on reset; a signed-in visitor to `/auth/login-1` is
  redirected to the dashboard; 429 from the rate limiter is surfaced as such.

### Phase 8 gotcha — `/auth/**` was `swr: 3600`

The auth pages were HTML-cached for an hour. Nitro served a stale render that
no longer matched the client bundle, so **every visit logged a hydration
mismatch** — I chased it through the layout before finding the route rule. It
also meant a shipped change to the login form would be invisible for up to an
hour, and `/auth/recover` varies by `?token=`. Now `swr: false`, the same rule
`/dashboards/**` learned in ADR-008. Note the browser also caches the response,
so after changing this you must bust the URL to see it.

### Phase 8 gotcha — a comment before the root element is a second root

A template whose first node is an HTML comment is multi-root, so the client
hydrates a Fragment where the server rendered an element. Keep layout
commentary inside the root node.

### Phase 8 note — the legal pages are deliberately not written

`/legal/terms` and `/legal/privacy` exist so the consent links resolve and so
clicking one opens a document rather than toggling the checkbox. Neither
contains the actual legal text — writing a real UK company's Terms and Privacy
Policy is not something to generate. Both carry `TODO(legal)` and state where
the binding terms currently live (the signed project agreement) and how to
request them. **A consent checkbox pointing at a page without the terms is
still not an enforceable click-wrap** — publishing the real documents into
those routes is a launch blocker.

**Phase 9 in progress (Mobile & Light).** Two specs: `PHASE-9-MOBILE.md` and
`PHASE-9-LIGHT-THEME.md`. Several of their §0 items were already closed by earlier
phases — the Support pane offset (Phase 6), Settings' `.hidden` override (Phase 7),
the >12 installment bar collapse (Phase 5) and `viewport-fit=cover` (responsive pass).

**Landed so far**

- **Light muted text was below AA.** The ramp's 500 step (`#6b747b`) cleared the page
  and cards but failed the surfaces secondary text actually sits on: 4.48:1 on raised
  rows, 4.11:1 on the violet selection tint, 4.20:1 on the desk. Re-tuned to `#4a5258`
  (the design system's `--apex-gray-600`, its stated floor for light muted text) —
  7.46 / 6.85 / 6.99. Ratios were computed rather than taken from the spec's table.
  Dark had already been fixed in an earlier pass (`muted-500` → `#89959e`); re-checked
  at 5.10 card / 4.50 raised, with `muted-400` at 6.03 / 5.32. Only one non-text use of
  `bg-muted-500` exists in the customer pages (a status dot), so collapsing the 500 step
  onto 600 in light is safe.
- **`--apex-shell-offset` gained a mobile value** (94px below `md`, against the 109px
  desktop band). A page subtracting the desktop figure loses ~38px of height, which on
  the Support inbox is the composer sliding under the fold.
- **`interactive-widget=resizes-content`** added to the viewport meta, so the on-screen
  keyboard shrinks the viewport instead of covering the composer.
- **`ApexBottomNav`** — mobile tab bar (Home · Orders · Order · Wallet · Support) with
  52px rows, a raised centre create action, home-indicator inset, longest-prefix active
  matching identical to `ApexSidebarNav`, and a flow spacer so no page ends underneath
  it. Suppressed inside the New Order wizard — a checkout should not offer five ways to
  leave it. Verified at 393px (fixed to the viewport bottom, 79x52 targets, correct
  `aria-current`, zero horizontal overflow) and at 1280px (bar and spacer both
  `display:none`, so no desktop layout moved).

**Still outstanding — the bulk of the light conversion**

~227 unpaired `text-white` and ~83 bare `text-muted-400` across
balance / orders / services / wallet / support / settings.

**This is not a mechanical sweep.** The design system keeps deliberate navy islands —
the dashboard promo, the cash-balance card, the Wallet credit card, the auth brand
panel — plus every white-on-violet button, and their unpaired `text-white` is *correct*.
A blind pairing pass would wreck exactly the thing §4 of the light spec says to
preserve, so each one needs the rendered-surface contrast probe to decide. Also
outstanding: the shared `utils/status.ts` palette (§3), My Orders' filter bottom sheet,
Settings' drill-in section navigation, the Auth mobile brand header, and the mobile type
scale (§4 of the mobile spec).

**Phase 1 Mobile shipped (the shared shell at 393px).** Layout and hit-target
pass only — no endpoint, route or component-API change. Everything below `lg`;
desktop re-measured at 1280px afterwards and is unchanged (76px static bar, 32px
gutter, full breadcrumb, 260px rail, Services accordion back, 250px search field
with the ⌘K hint, bottom nav `display:none`).

New: `ApexSearch`, `ApexBottomSheet`, `ApexShell`, `ApexNotificationsList`,
`useIsCompact()`, `useApexDrawer()`.

- **The search button was a dead end dressed as a feature.** It opened Tairo's
  `DemoAppSearch`, which indexes the `docs` collection and routes with
  `meta.preview`. No Apex page sets `preview` (checked: 0 across all six), so
  customer pages were literally unindexable and a search for "orders" returned
  Tairo demo layouts plus a link to Shuriken UI docs — and the docs routes are
  404 in production. `ApexSearch` now serves `/dashboards/**` and `/admin/**`
  over the panel's destinations + the customer's own projects and tickets, via
  the two endpoints those pages already call. Verified: typing "w" returns
  Wallet/New order/Dashboard under **Pages** and the account's real projects
  (E-Commerce Redesign, P1 Verify Order, QA Test Project) under **Projects**.
- **Its results linked to query params nothing read.** `?project=` and
  `?ticket=` were ignored by both pages, so a result landed you on a list. Both
  now honour them, SSR included.
- Drawer: `100% - 68px`, 48px rows, Services flattened, close button, focus trap
  (Tab and Shift+Tab both wrap), Escape, scrim tap, route-change close, focus
  returned to the hamburger. `invisible` when closed so it leaves the tab order.
- Account and notifications are bottom sheets below `lg`, dropdowns above.
- Top bar 56px sticky/full-bleed; `--apex-shell-offset` 109 → **77px** below
  `lg`. Its media query said `max-width: 767px`, left behind when the shell moved
  to 1024px — so between 768 and 1023px the Support pane subtracted the desktop
  figure. Now measured exact: pane top 77 + height 735 = 812 viewport.

Verified at 375×812 (narrower than the spec's 393): all six customer routes and
all seven admin routes SSR 200, zero page-level horizontal scroll on every one,
h1 23px, header actions 48px full-width below the copy (Settings' pair shares
the row at flex:1), AA contrast on the bar, bottom nav, drawer, both sheets and
search in **both** themes with zero failures, console clean (no hydration
mismatch, no reka warning). ESLint clean.

### Phase 1 Mobile gotcha — the preview pane is a hidden tab, so transitions never run

`document.hidden` is `true`, `requestAnimationFrame` never fires and every
CSS transition sits at `currentTime: 0` forever. That pins any transitioned
property at its *start* value: the drawer read `visibility: hidden` while open
and the scrim read `opacity: 0`, both of which look exactly like product bugs
and are not. **Neutralise transitions before measuring**
(`*{transition:none!important;animation:none!important}`) or the end state is
unobservable. It also changed a real decision: `visibility` is kept out of the
drawer's transition list, because an accessibility property must not depend on a
transition completing.

### Phase 1 Mobile gotcha — the layer's markup is scanned, but check before blaming Tailwind

When the drawer would not become visible, the first hypothesis was that
`layers/tairo/**` is outside Tailwind's content scan. It is not —
`layers/tairo/theme.css` has `@source './components'`, and `.visible` /
`.invisible` / `.opacity-100` were all present in the served CSS (confirmed by
fetching the stylesheet text and by probing a synthetic element). The cause was
the frozen timeline above. Note that `document.styleSheets` walking needs
per-rule `try/catch` and recursion into `@layer` blocks, or it silently reports
"no matching rule".

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
