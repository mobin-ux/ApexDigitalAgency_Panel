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

- **Default theme: dark** (`colorMode.preference: 'dark'`), brand direction. The toolbar
  `BaseThemeToggle` still switches to light — so every page must be built to work in both.
- **Palette (set once in `main.css`):**
  - `primary` → **indigo** — the accent/CTA colour that complements the navy base.
  - `muted` → a custom **navy/charcoal** scale — every surface, border and neutral text.
  - Re-theme the whole app by editing those token blocks; never hardcode hex.
- **Currency: GBP (£)** via `useCurrency()`.

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
| 1 | Balance (home dashboard) + fix `/api/dashboard/stats` | ⏳ Next |
| 2 | Orders | ☐ |
| 3 | Services + New Order / financing & installment calculator | ☐ |
| 4 | Wallet & Credit (installments, history, invoices) | ☐ |
| 5 | Support (ticketing) | ☐ |
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
- [x] Duplicate `useUser.ts` (`.demo/composables/` vs `.demo/app/composables/`) and
      duplicate auth plugins (`auth.ts` + `auth-load.ts`) removed.

To address:
- [ ] **`/api/dashboard/stats` throws `PrismaClientValidationError`** (schema drift) → the
      home page falls back to placeholders. Fix as part of Page 1 (balance).
- [ ] Stale seed scripts reference fields not in the schema: `server/api/seed-rich.get.ts`,
      `seed-wallet.get.ts`, and `prisma/seed.js` (uses `name`/`status`/`USER`). Dev-only.
- [ ] Pages still hardcode dark hex + USD + native `alert()`/`confirm()` until refactored
      (orders, services, wallet, support, settings, balance).
- [ ] `orders.vue` formats prices in USD and has a hardcoded "Sarah Connor" project manager.
- [ ] Mixed English / Persian inline comments across pages (cosmetic; standardise to English).
- [ ] Local dev uses an Iran mirror in `.npmrc` that 403s intermittently; `registry.npmmirror.com`
      worked (`pnpm install --registry=https://registry.npmmirror.com/`).
