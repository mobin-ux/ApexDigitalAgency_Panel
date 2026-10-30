# CLAUDE.md — Apex Digi Customer Dashboard

Customer dashboard for **Apex Digi** (apexdigi.co.uk, UK agency) built on the **Tairo**
template (Nuxt 3 + Vue 3 + Shuriken UI + Tailwind v4) in a pnpm monorepo.
Detail lives in the docs — read on demand, don't guess:

- @docs/ARCHITECTURE.md — full architecture + rationale
- @docs/REQUIREMENTS.md — business/functional/security requirements
- @docs/decisions/ — ADRs (one per major decision)
- @DESIGN_SYSTEM.md — design language, palette, conventions, page roadmap
- @MEMORY.md — living state: done / in progress / next / open questions

## Critical context

- **The active app is `.demo/`** — NOT `.app/` (empty shell). Customer pages:
  `.demo/app/pages/dashboards/{balance,orders,services,wallet,support,settings}.vue`.
- Run: `pnpm demo:dev` → localhost:3000. Dev login: `user@apex.com` / `user123`
  (seed via GET `/api/create-admin`; sample data: `/api/seed-orders|seed-support|seed-notifs`).
- Backend: Nitro routes in `.demo/server/api/`, Prisma + SQLite (`prisma/schema.prisma`).
- Auth: JWT in `auth_token` cookie; `useUser()` composable; `middleware: 'auth'`.

## Hard rules — never violate

1. **Tokens, not hex** for surfaces/text/borders (`bg-muted-800`, `text-primary-400`…).
   Only the fixed status accents may be literal: `#22B07D` success, `#F2C14E`/`#D9A521`
   amber, `#EC6453` coral, `#6EA8FE` completed-blue.
2. **GBP only**, via `useCurrency().formatCurrency()` — never `$`, never raw Intl.
3. **No native dialogs** — `useNuiToasts().add(...)`; confirmations via modal.
4. **Never SWR-cache authenticated routes** (`/dashboards/**` has `swr: false` — keep it).
5. **Never commit** `prisma/dev.db` changes or `graphify-out/`.
6. **Commit every change** (conventional commits, detailed body) and **push to `master`**.
7. **The design export is the spec** — never improvise spacing/grid/columns; arbitrary
   values (`p-[22px]`, `rounded-[28px]`, `text-[13.5px]`) are intentional pixel fidelity.
8. **Never kill the user's dev server on port 3000**; preview uses `autoPort` (launch.json).
9. **Never fabricate financial actions** — no fake charges; route to Wallet + `TODO(api)`.
10. Rewrite Persian comments to English whenever touching a legacy file.
11. **Admin routes gate on a permission, not on "is admin"** — every
    `/api/admin/**` handler calls `requireStaffPermission(event, '<perm>')` from
    the eleven in `shared/permissions.ts` (ADR-016). Never add an admin endpoint
    on bare `requireAdmin`, and never duplicate the matrix: the admin UI reads
    the same file, which is what stops the documented and enforced rules drifting.

## Conventions

- **Customer pages are Panel v2** (`Panel Breakpoints.dc.html`, ADR-019): light by
  default with a dark toggle, sidebar ≥1200px (`desk:`), 88px rail ≥768px, 60px
  bar + five tabs below. Page skeleton: `definePageMeta({ title, layout: 'sidenav',
  middleware: 'auth' })` and a wrapper `@container mx-auto max-w-[1260px] flex
  flex-col px-[clamp(16px,3vw,40px)] …` — the page owns its gutter, and layout
  switches use container queries (`@min-[720px]:`), not viewport breakpoints.
- **Panel v2 tokens, not light/dark pairs:** `bg-card`, `bg-raised`, `text-fg-heading`,
  `text-fg-muted`, `border-line-subtle`, `text-accent-ink`, `bg-st-<tone>-bg`…
  (main.css). Components: `ApexButton`, `ApexStatusChip`, `ApexField`, `ApexGlyph`.
  Status labels come from `projectStatus()` and schedules from `orderSchedule()`.
- **Admin is the Admin Console** (`Admin Console.dc.html`, 2026-10-31): light and
  dark, `layouts/admin.vue` + `AdminConsoleSidebar`, nav table `utils/adminNav.ts`.
  Build screens from `AdminPage`, `AdminPageHeader` (title + accent), `AdminCard`,
  `AdminButton`, `AdminStatusChip`, `AdminDialog`, `AdminDrawer` and
  `useAdminConfirm().ask()` (reason required wherever the API stores one); tables
  switch to fixed columns at `xl`. Auth and legal routes stay pinned dark.
- Radius scale: surfaces `rounded-2xl`, inner rows/inputs/icon buttons `rounded-xl`,
  pills `rounded-full`. No new arbitrary `rounded-[Npx]` for either.
- Static assets go in **`.demo/public/`**. `.demo/app/public/` is not served.
- Anything derived from `navigator`/`window` must resolve in `onMounted` (or
  `<ClientOnly>`) — earlier hooks run before the hydration render and mismatch.
- Components: `<BaseButton variant="primary|muted|ghost" rounded="full|lg" size="lg">`,
  `<BaseCard rounded="lg">`; icons `<Icon name="lucide:...">`.
- Headings/big numbers: `font-heading` (Yellix) + `font-extrabold` + `tracking-[-0.02em]`;
  money gets `tabular-nums`. Body/UI font is Inter (default `font-sans`).
- Data-driven templates for repetition (see `formSchemas` in services.vue).
- Custom animations need `prefers-reduced-motion` guards; a11y: aria-pressed/labels/roles.
- Honest placeholders: anything not backed by the API is flagged `// TODO(api): ...`.
- Lint before commit: `pnpm exec eslint --fix <files>` (@antfu config: 1 statement/line,
  parenthesize mixed `||`/`&&`, `import process from 'node:process'`).

## Key commands

| Task | Command |
|---|---|
| Install (mirror 403 workaround) | `pnpm install --registry=https://registry.npmmirror.com/` |
| Dev server | `pnpm demo:dev` (or `./dev.sh` for `--host`) |
| Lint / typecheck | `pnpm exec eslint --fix <files>` / `pnpm test:tsc-demo` |
| Prisma client | auto (`postinstall`); manual `pnpm exec prisma generate` |
| Preview (agent) | `.claude/launch.json` config `demo` — autoPort, coexists with :3000 |

## Architecture map

```
.demo/app/pages/dashboards/   customer pages (redesigned: balance, services, orders)
.demo/app/composables/        useUser, useCurrency, useNotifications
.demo/app/layouts/sidenav.vue customer shell (nav + real user + sign out)
.demo/app/assets/main.css     THE token source: violet primary, navy-ink muted, Yellix
.demo/server/api/             Nitro endpoints (auth, orders, finance, support, settings)
.demo/server/utils/           requireAuth / requireStaffPermission, prisma, zod, audit
.demo/shared/                 imported by BOTH halves: permissions.ts (the staff role
                              matrix the UI renders AND the server enforces — ADR-016),
                              support-eta.ts, audit-kinds.ts
.demo/server/utils/deliverables.ts  the ONE answer to "are these files in the client's
                              hands" — read by the admin panel and by /api/orders, so the
                              two can't disagree (ADR-017)
prisma/schema.prisma          User/Project/Milestone/Transaction/Installment/Ticket…
```

## Workflow

- User sends **Claude Design zips** (canonical source; `*.dc.html` + `_ds` bundle) per
  page → implement pixel-faithful on the token system → lint → verify in preview
  (DOM/`preview_eval` checks, NOT screenshots — they time out on this machine) →
  update DESIGN_SYSTEM.md roadmap → commit → push.
- Financing math is locked (ADR-011): 12-mo = 0% (`base/12`); 24-mo = 1%/mo amortized
  (`base·0.01/(1−1.01⁻²⁴)`). Plan catalogue lives in `services.vue`.
- Verify SSR auth flows with curl + cookie jar when the browser is flaky.

## Public website (`web/`)

The marketing site (apexdigi.co.uk) is a **separate Nuxt 4 app**, `@apex/web`, that
sells and then hands visitors to the panel — see
@docs/decisions/ADR-018-public-marketing-site.md and `web/README.md`.
Run `pnpm web:dev` · lint `pnpm exec eslint --fix web` · types `pnpm web:typecheck`.
The panel's hard rules above are about the panel. In `web/`: tokens not hex (`@theme`
in `app/assets/css/main.css`), copy as typed data in `app/data/`, **no invented facts**
(an empty string hides its UI — never a placeholder company/VAT number or phone),
`motion-safe:` on every animation, AA contrast on rendered text, internal links via
`app/data/routes.ts`. Never import panel code, Prisma or the JWT utils into it.

## Scope boundaries

- Don't touch `.app/` or `layers/tairo` internals unless asked. The Tairo demo pages
  (`/layouts/**`, `/starters/**`, `/wizard`, the template dashboards) and the components,
  APIs and images only they used were deleted — don't reintroduce them. The vendor docs
  subsystem (`.demo/content`, `examples/`, `pages/documentation`) is still wired to
  `@nuxt/content` and was deliberately left.
- `settings.vue`, auth pages are still OLD style
  (hex/USD/alerts) — they get rebuilt only when their design zip arrives.
- Global hydration-mismatch warnings are a known pre-existing issue (shared chrome) —
  not caused by page work; don't chase per-page.
