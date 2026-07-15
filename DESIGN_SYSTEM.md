# Apex Digi Dashboard — Design System & Refactor Guide

Living document for the customer dashboard built on the **Tairo** (Nuxt 3 + Shuriken UI +
Tailwind v4) template. Keep this updated as pages are refactored.

## 1. Stack at a glance

| Layer | Tech |
|---|---|
| Framework | Nuxt 3 (compatibility v4), Vue 3 `<script setup>` |
| Active app | `.demo/` (workspace pkg `demo`). `.app/` is unused. |
| UI kit | Shuriken UI (`<Base*>` components), Tairo layout components (`<Tairo*>`) |
| Styling | Tailwind CSS v4, design tokens in `.demo/app/assets/main.css` |
| Backend | Nitro server routes (`.demo/server/api`), Prisma + SQLite (`prisma/`) |
| Auth | JWT in cookie (`auth_token`), `auth` middleware, `useUser()` composable |
| i18n | `@nuxtjs/i18n` (en/fr/es/de/ar/ja), `no_prefix` strategy |
| Money | GBP via `useCurrency()` |

The customer pages live in `.demo/app/pages/dashboards/`: `balance` (home, `/` redirects
here), `orders`, `services`, `wallet`, `support`, `settings`. All use `layout: 'sidenav'`
and `middleware: 'auth'`.

## 2. Brand & theme decisions

Source of truth: the **Apex design system** the client provided (Claude Design export).
Imported tokens/font live in the bundle; the values below are mirrored into `main.css`.

- **Default theme: dark** (`colorMode.preference: 'dark'`). The app/dashboard uses the
  Apex dark navy "ink" treatment; the marketing site is light. Toggle still works.
- **Palette (set once in `main.css`):**
  - `primary` → **electric violet `#7D53F2`** (brand accent: buttons, links, highlights).
  - `muted` → warm-cool grays (light end) down to deep navy **ink** (`#0B1517` page /
    `#16252A` card) on the dark end — the dashboard's surfaces.
  - Re-theme the whole app by editing those two ramps; never hardcode hex.
- **Fonts:** **Yellix** (display/headings + big numbers) via the `font-heading` utility;
  **Inter** for body/UI. Yellix `.woff` files in `/public/fonts/yellix`.
- **Currency: GBP (£)** via `useCurrency()` (design mocks show `$`; the brand is UK → £).
- **Brand assets:** `apex-icon.svg` / `apex-wordmark-dark.svg` in `/public/brand`.

## 3. Conventions ("rebuilt properly")

Earlier custom pages bypassed the design system (hardcoded `bg-[#0f111a]`, raw `<button>`,
native `alert()`, USD). When refactoring a page, bring it in line:

1. **Use design tokens, not hex.** `bg-muted-950`, `border-muted-800`, `text-muted-400`,
   `text-primary-500` — never `bg-[#161925]`. For surfaces that must work in both themes use
   light/dark pairs, e.g. `bg-white dark:bg-muted-950`, `border-muted-200 dark:border-muted-800`.
2. **Use components, not raw HTML.** `<BaseCard>`, `<BaseButton>`, `<BaseInput>`,
   `<BaseHeading>`, `<BaseParagraph>`, `<BaseAvatar>`, `<BaseTag>` instead of bespoke divs.
3. **No native dialogs.** Replace `alert()`/`prompt()` with `useNuiToasts().add(...)`;
   replace `confirm()` with a `<TairoModal>`/`<BaseDialog>` confirmation.
4. **Money** goes through `useCurrency()` (`formatCurrency`).
5. **Responsive first.** Mobile → tablet (`md:`) → desktop (`lg:`/`xl:`). Test all three.
6. **Keep the dark glassmorphism feel** (soft gradients, blur accents, rounded surfaces) but
   express it through tokens so it themes correctly.

## 4. Roadmap (page-by-page)

| # | Area | Status |
|---|---|---|
| 0 | **Foundation** — tokens, dark default, `sidenav` cleanup, `useCurrency`, app.config | ✅ Done |
| 0b | **Auth/infra fixes** — reload-logout, SWR cache, Prisma generate, duplicate code | ✅ Done |
| 1 | Balance (home dashboard) + fix `/api/dashboard/stats` | ✅ Done |
| 2 | My Orders (`orders.vue`) — Apex Design redesign (list + detail + payment plan) | ✅ Done |
| 3 | New Order / financing wizard (`services.vue`) — Apex Design redesign | ✅ Done |
| 4 | Wallet & Credit (`wallet.vue`) — Apex Design redesign (overview/transactions/installments/banking + top-up & credit modals) | ✅ Done |
| 5 | Support (`support.vue`) — Apex Design redesign (tickets inbox+thread / new request / FAQ) | ✅ Done |
| 6 | Settings | ☐ |
| 7 | Auth flow (login / signup / recover) | ☐ |

## 5. Known issues

Fixed:
- [x] **Reload logged users out.** Refreshing/direct-loading any `/dashboards/*` page
      bounced to login. Two causes: (1) `swr: 3600` on `/dashboards/**` cached the first
      unauthenticated render and served it to everyone; (2) `fetchUser()` used plain
      `$fetch`, dropping the cookie during SSR. Fixed by `swr: false` on `/dashboards/**`
      and `useRequestFetch()` in `useUser`.
- [x] **App broke after a fresh `pnpm install`** (Prisma client not generated → "Named
      export 'PrismaClient' not found"). Added `postinstall: prisma generate`.
- [x] **Page content had no horizontal gutter below ~1200px** — sections/cards ran flush
      to the viewport edge on most laptop, tablet and mobile widths. Root cause:
      `sidenav.vue` wrapped only `<DemoToolbar>` in `px-4 md:px-6 xl:px-8`; `<slot />`
      (every page's actual content) rendered as an unpadded sibling, and the documented
      page-wrapper convention (`mx-auto max-w-[1180–1240px] …`) has no `px-*` of its own —
      so nothing provided a gutter below each page's max-width. Fixed once, in the shared
      layout, by nesting `<slot />` inside that same padded div — every page inherits it,
      no per-page changes needed. Same pass also fixed a couple of narrow-viewport spots
      that predated it: the Transactions-tab filter pills on Wallet could wrap into a
      two-row stadium shape instead of scrolling, and the New Order success modal's two
      footer buttons didn't stack on very narrow phones.
- [x] Duplicate `useUser.ts` (`.demo/composables/` vs `.demo/app/composables/`) and
      duplicate auth plugins (`auth.ts` + `auth-load.ts`) removed.
- [x] **Flagship-phone responsive pass** (`c3f7f2b`). Safe-area/`dvh`: `viewport-fit=cover`
      (nuxt.config) so `env(safe-area-inset-*)` resolves; shell gutters use
      `max(<gutter>, env(inset))`; support split-pane + wallet/services modals use
      `100dvh - env(top/bottom)` so height tracks the mobile URL bar and clears the
      notch/home-indicator (no-ops in normal tabs). Layout: wallet installment rows reflow
      to two lines under `sm` (no overflow at 393px); top-up presets `grid-cols-2 sm:grid-cols-4`;
      DemoToolbar gains a `md:hidden` search icon (search had no <768px entry point) and a
      `min-w-0`/`truncate` breadcrumb that drops the parent crumb under 400px. **Build-fix:**
      a literal `pt-[env(...)]` written as shorthand *inside a sidenav comment* was scanned
      by Tailwind v4, emitted invalid `padding-top: env(...)`, and lightningcss 500'd the
      whole dev server — Tailwind scans comments too; document classes in valid form or prose.
      Verified at 1440px + 393px, no horizontal overflow, restructured layouts revert to
      single-line/multi-column at ≥sm.

To address:
- [ ] **Hydration mismatch warnings** ("Hydration completed but contains mismatches") on
      every dashboard page — pre-existing and global (also on the shipped Balance page), so
      it lives in the shared chrome (toolbar / color-mode / i18n), not a single page. Run
      down the SSR-vs-client diff in the `sidenav` layout + `DemoToolbar` and fix.
- [ ] Stale seed scripts reference fields not in the schema: `server/api/seed-rich.get.ts`,
      `seed-wallet.get.ts`, and `prisma/seed.js` (uses `name`/`status`/`USER`). Dev-only.
- [ ] Pages still hardcode dark hex + USD + native `alert()`/`confirm()` until refactored
      (settings).
- [ ] Credit-line, expense-split (balance) and the service "from" prices / order plan
      catalogue (new order) are front-end placeholders — back them with real API/data models.
- [ ] `orders.vue` formats prices in USD and has a hardcoded "Sarah Connor" project manager.
- [ ] Mixed English / Persian inline comments across pages (cosmetic; standardise to English).
- [ ] Local dev uses an Iran mirror in `.npmrc` that 403s intermittently; `registry.npmmirror.com`
      worked (`pnpm install --registry=https://registry.npmmirror.com/`).
