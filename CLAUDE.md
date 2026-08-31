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

- Page skeleton: `definePageMeta({ title, layout: 'sidenav', middleware: 'auth' })`;
  wrapper `mx-auto max-w-[1180px] flex flex-col gap-8`. Horizontal gutter comes
  from `sidenav.vue`'s shared `px-4 md:px-6 xl:px-8` wrapper (applied to toolbar +
  `<slot />` together) — don't add page-level `px-*`, it would double up.
- **Shell vocabulary (V2 Phase 1) — use these, don't re-roll them:**
  `<ApexPageHeader>` (30px two-tone H1 + sub-line + one 44px pill action; no eyebrow
  labels), `<ApexSectionLabel>` (3px violet bar + 12px uppercase), `<ApexSidebarNav>`,
  `<ApexAccountMenu>`, `<ApexNotificationsMenu>`. Location lives **only** in the
  toolbar breadcrumb — never print a second one in a page.
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

## Scope boundaries

- Don't touch `.app/`, template demo pages (`/layouts/**`, `/starters/**`), or
  `layers/tairo` internals unless asked.
- `settings.vue`, auth pages are still OLD style
  (hex/USD/alerts) — they get rebuilt only when their design zip arrives.
- Global hydration-mismatch warnings are a known pre-existing issue (shared chrome) —
  not caused by page work; don't chase per-page.
