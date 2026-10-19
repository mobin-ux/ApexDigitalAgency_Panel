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
| Security | `nuxt-security` in `strict` mode | CSP with nonces/hashes, COEP/COOP/CORP, HSTS preload, GET/HEAD only (POST on `/api/contact` alone) |
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
    ui/                 Button, EyebrowChip, SectionHeader, ServiceGlyph, MediaFrame,
                        Breadcrumbs, FaqList, Tick, TechMark, FilterChip, Stars, Field
    home/               one component per homepage section
    services/           one component per /services section
    service/            the sections of /services/[slug], driven by a content file
    work/               one component per /our-work section
    case-study/         the sections of /our-work/[slug]: hero, results, story
                        (contents list + four chapters + chart), CTA, similar projects
    article/            the sections of /insights/[slug]: hero, share row, body
                        (contents list + typed blocks + FAQ), CTA, keep reading
    about/              one component per /about section
    contact/            the sections of /contact: hero, message form, side panel,
                        studio card, FAQ
  data/                 typed content: routes, site, services, services-page, plans,
                        home, content, case-studies, case-study-page, our-work, articles,
                        article-page, about, contact, and service-pages/ (one file per service page)
  composables/          usePanelLinks, useServiceLinks, useContactForm
  utils/                formatters, initials, studio (the studio address and its links)
  pages/                one file per route
shared/contact.ts       the contact form's ids, limits and validator, used by page AND server
server/api/contact.post.ts  the site's one write: validates and emails a message
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
  `companyNumber`, `vatNumber`, `icoNumber`, `insurance`, the street address,
  social URLs) is an empty string and its UI is hidden until filled — on the
  About page that includes each paperwork row, its register link and the tick
  that claims it. Search the repo for `TODO(content)` / `TODO(legal)`.
- **Internal URLs come from `app/data/routes.ts`.** Pages are linked by their
  final URL before they exist; the link checker is off until they do.
- **Interactive only when needed.** The FAQ is native `<details>`, the services
  menu works without JS, and the plan explainer hydrates when scrolled into view.
- Every animation uses `motion-safe:`; every control has a visible focus ring.
- British spelling, sentence-case headings, GBP with VAT stated.
- **Service pages are content files.** `/services/[slug]` renders whatever
  `app/data/service-pages/<slug>.ts` describes (typed by `types.ts`) and 404s
  for a service without one; register it in `service-pages/index.ts` and it is
  prerendered too. Prices in copy are read from `data/plans.ts`, never typed.
  A page picks one of three plan forms (`terms` with the 12/6-month switch,
  `monthly`, or `scoping`) and one of seven hero drawings
  (`components/service/visual/`) by `kind`.
- **Filters are progressive.** The services finder and the Our work filters
  prerender the full list, mirror the selection in the query string
  (`?goal=`, `?service=` / `?sector=`) and read it after mount, because a
  prerendered page is one file for every query string.
- **Case studies come from one catalogue.** `data/case-studies.ts` holds every
  study; `/our-work/[slug]` renders the full write-up when a study has a
  `story`, and otherwise a short summary page that `nuxt.config.ts` marks
  `noindex, follow` (and so keeps out of the sitemap) until the story exists.
- **Articles are data, block by block.** `data/articles.ts` holds every
  article; an entry with a `body` (sections of typed blocks: paragraph, table,
  note, checklist, costs, quote, service card) gets a prerendered
  `/insights/[slug]` page, and one without is a teaser that can be listed but
  404s until it is written. Homepage teasers are views of the same catalogue.
- **No style attributes.** The strict CSP blocks them, so sizes are classes.
  Data-driven sizes are generated: the case-study chart's bar heights are
  `h-[N%]` classes from an `@source inline` range in `main.css`. The article
  reading bar is a CSS scroll-driven animation (`.reading-progress`), opted
  into with `definePageMeta({ readingProgress: true })`.
- **No third-party requests.** Technology logos come from a local sprite,
  `public/icons/tech.svg`, built from Simple Icons by `pnpm icons` — run it
  after adding an `icon: '<slug>'` to any content file; it fails on an
  unknown slug.

## Deploy

`bash scripts/ship-web.sh` from the repo root (deploy key `~/.ssh/apex_deploy`).
It builds on the server, so the bundled `sharp` binary is Linux's, and
restores the previous build if the new one fails its health check. Server
layout and env are documented at the top of the script.

## Environment

See `.env.example`. In production set `NUXT_PUBLIC_SITE_URL`,
`NUXT_PUBLIC_PANEL_URL` and `NUXT_SITE_ENV=production` — without the last one
the site serves `noindex` and a disallow-all `robots.txt` on purpose.

The contact form delivers through Resend when `NUXT_CONTACT_RESEND_API_KEY`,
`NUXT_CONTACT_TO` and `NUXT_CONTACT_FROM` are all set (the sender must be on
a domain verified in Resend). Until then `POST /api/contact` answers 503 and
the form says the message was not sent, offering the visitor's own email
with everything they typed. The endpoint is rate-limited per IP in memory,
which is right for one Node process; behind several, give nuxt-security's
rate limiter a shared storage driver.
