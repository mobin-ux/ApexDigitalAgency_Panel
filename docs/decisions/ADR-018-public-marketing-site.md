# ADR-018 — The public marketing site is its own Nuxt 4 app in `web/`

**Status:** Accepted (2026-10-15) — begins the "public website" phase, the work
that sells and then hands the visitor to the customer panel.
**Context:** the panel (`.demo/`) is a logged-in product. The marketing site is a
different job: be found, be fast, be trusted, and convert. Its design comes from
the same Claude Design project (`Homepage.dc.html` first; About, Services,
Our Work, Insights, Contact and the service pages follow).

## 1. Separate app, same repository

`web/` (`@apex/web`) lives in the panel's repository but is **its own pnpm
project**: its own `pnpm-workspace.yaml`, `pnpm-lock.yaml` and `node_modules`,
deployed independently. The repo shares tooling (ESLint config, git hooks,
scripts) and brand assets, and **nothing at runtime** — the only coupling is
`NUXT_PUBLIC_PANEL_URL`, read by `usePanelLinks()`. That keeps the public attack
surface free of the panel's Prisma, JWT and payment code.

It was first added as a member of the panel's workspace. That re-resolved the
panel's lockfile — pnpm's peer de-duplication moved `.demo` onto TypeScript
5.9, Vue 3.5.44 and Vite 8 peer variants — so it was split out: installing or
upgrading the site must never change how the panel resolves. The root
`web:dev` / `web:build` / `web:typecheck` scripts call into it with
`pnpm --dir web`.

It runs **Nuxt 4** (the panel is on 3.16) because it is a new app with no
Tairo dependency.

## 2. Stack, and why each piece

| Need | Choice |
|---|---|
| Rendering | Nuxt SSR with `routeRules` prerender for marketing routes — crawlers get full HTML, the server has nothing dynamic to attack |
| Styling | Tailwind v4; the Apex tokens are one `@theme` block (`assets/css/main.css`), the default palette is removed so a stray `bg-blue-500` cannot compile |
| SEO | `@nuxtjs/seo` (canonical, sitemap, robots, schema.org). Structured data is built from the **same data objects** that render the page, so the FAQ markup cannot drift from the visible FAQ |
| Security | `nuxt-security` in `strict` mode: nonce/hash CSP with `default-src 'none'`, COEP `require-corp`, COOP/CORP same-origin, HSTS preload, GET/HEAD only (one exception, below), no CORS |
| Fonts | Yellix self-hosted; Inter via `@fontsource-variable/inter`. No request leaves the origin, which is also the GDPR-clean answer |
| Interactivity | Only where needed: native `<details name>` FAQ, a no-JS services menu, a reka-ui drawer, and one hydrate-on-visible island |

## 3. Rules that carry forward

- **Content is typed data** in `app/data/`; markup does not change when copy does.
- **Anything unconfirmed is empty, and its UI is hidden** (phone, company and VAT
  number, social URLs). A made-up statutory number on a UK company site is a
  legal defect, so there are no placeholders in production markup.
- **Internal links come from `data/routes.ts`**, and may point at pages that do
  not exist yet; the link checker is off until the site is complete.
- **Accessibility is measured, not assumed.** The design's 45%/38% alpha greys
  fail AA (3.2:1, 2.5:1); body/muted text are solid colours that clear 4.5:1 on
  both the page and the `#F7F8F9` section background. A scan of the rendered
  homepage checks every text node.
- Every animation is behind `motion-safe:`; every control has a visible focus
  ring; the mobile drawer traps focus, closes on Escape and returns focus.

## 4. The one write: `POST /api/contact` (2026-10-18)

The Contact page needed somewhere to send a message, so the site gained exactly
one server route. It stays inside the rules above: POST is allowed on that path
alone (route rules), the body is capped at 16 KB, each IP gets five messages per
ten minutes, cross-site requests are refused (`Sec-Fetch-Site`, and a JSON body
needs a preflight the site never answers), a honeypot catches form bots, and
the page and the server share one validator (`shared/contact.ts`). It stores
nothing: it emails the team through Resend's REST API with no SDK, and sends
nothing to the visitor, because an auto-reply from a public form can be aimed
at anyone's inbox. Unconfigured, it answers 503 and the page offers a mailto
with the visitor's text instead of claiming the message arrived.

## 5. Known constraints

- **`nuxt-ai-ready` (llms.txt / markdown-for-agents) is off.** It needs the
  `@mdream/rust-win32-x64-msvc@2.0.3` native binding, which the npm mirror in
  `.npmrc` has not synced; a Windows build fails with it on. Revisit when the
  mirror catches up or builds move to Linux CI.
- **Production builds are slow on Windows.** Nitro's `node-externals` resolver
  does millions of `stat` calls on a pnpm tree; build on Linux/CI where
  possible.
- Real photography, client logos, case-study content, the legal pages and the
  Companies House details are `TODO(content)` / `TODO(legal)`.
