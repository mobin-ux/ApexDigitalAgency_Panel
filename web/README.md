# @apex/web — Apex Digital Agency public website

Marketing site for apexdigi.co.uk. It sells, then hands the visitor to the
customer panel (`.demo/`, deployed on its own subdomain). The two apps share a
repository but nothing at runtime — the only coupling is the panel URL.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Nuxt 4 · Vue 3 · TypeScript (strict) | Same family as the panel; SSR/prerender gives crawlers real HTML |
| Styling | Tailwind CSS v4, tokens in `app/assets/css/main.css` | The Apex design-system tokens live in one `@theme` block |
| Rendering | Marketing routes prerendered (`routeRules`) | Static HTML: fastest TTFB, smallest attack surface |
| SEO | `@nuxtjs/seo` (sitemap, robots, schema.org, canonical, meta) | One config for every crawler-facing file |
| Security | `nuxt-security` in `strict` mode | CSP with nonces/hashes, COEP/COOP/CORP, HSTS preload, GET/HEAD only |
| Images | `@nuxt/image` | AVIF/WebP + responsive `srcset` once real artwork exists |
| Accessible UI | `reka-ui` (mobile drawer) | Focus trap, Escape, scroll lock done properly |
| Fonts | Yellix (self-hosted) + Inter Variable (`@fontsource-variable/inter`) | No third-party font requests, GDPR-friendly |

## Commands

`web/` is its own pnpm project (own lockfile and `node_modules`), so the
panel's dependencies never move when the site's do. Install inside it:

```bash
cd web && pnpm install
```

Then, from the repo root:

```bash
pnpm web:dev        # http://localhost:3000 (use --port if the panel is running)
pnpm web:build      # production build → web/.output
pnpm web:typecheck  # vue-tsc
pnpm exec eslint --fix web/app   # lint (repo root config)
```

## Layout

```
app/
  assets/css/main.css   design tokens (@theme) + base styles
  components/
    layout/             Header, ServicesMenu, MobileMenu, Footer
    ui/                 Button, EyebrowChip, SectionHeader, ServiceGlyph, MediaFrame
    home/               one component per homepage section
    services/           one component per /services section
  data/                 typed content: routes, site, services, services-page, home, content
  composables/          usePanelLinks
  utils/                formatters
  pages/                one file per route
```

Components are auto-imported with a path prefix: `components/home/Hero.vue`
is `<HomeHero>`, `components/ui/Button.vue` is `<UiButton>`.

## Conventions

- **Tokens, not hex.** Colours, radii, shadows and type sizes come from
  `@theme`; arbitrary values are limited to pixel-exact decorative artwork.
- **Content is data.** Copy lives in `app/data/*.ts`, typed, so a page's
  markup never changes when its wording does and the same facts (prices,
  service names, FAQ) feed the UI *and* the structured data.
- **No made-up facts.** Anything unconfirmed (`company.phone`,
  `companyNumber`, `vatNumber`, social URLs) is an empty string and its UI is
  hidden until filled. Search the repo for `TODO(content)` / `TODO(legal)`.
- **Internal URLs come from `app/data/routes.ts`.** Pages are linked by their
  final URL before they exist; the link checker is off until they do.
- **Interactive only when needed.** The FAQ is native `<details>`, the services
  menu works without JS, and the plan explainer hydrates when scrolled into view.
- Every animation uses `motion-safe:`; every control has a visible focus ring.
- British spelling, sentence-case headings, GBP with VAT stated.

## Environment

See `.env.example`. In production set `NUXT_PUBLIC_SITE_URL`,
`NUXT_PUBLIC_PANEL_URL` and `NUXT_SITE_ENV=production` — without the last one
the site serves `noindex` and a disallow-all `robots.txt` on purpose.
