# ADR-021 — The website is managed from the panel: content overlay, SSR over cached data, fixed roles

**Status:** Accepted (2026-10-28). Amends ADR-016 (adds two roles and six
permissions to the fixed matrix) and ADR-018 (one server-to-server runtime read
between the site and the panel).
**Context:** the business needs to change website copy, publish landing pages,
manage navigation, media, SEO and redirects, and edit a few customer-facing panel
documents without a code deploy. The panel already has the admin shell, the
permission matrix, audit, uploads and a typed settings store; the site is a
separate, prerendered Nuxt 4 app whose copy is typed data in `app/data/`.

## 1. The panel is the CMS; the site keeps its code baseline and renders an overlay

- Documents live in the panel's SQLite (`SiteDocument` + `SiteRevision`,
  `SiteRedirect`, `SiteMedia`, `SiteMediaRef`, and `website.*` rows in `Setting`).
  Pages, globals (header, footer, announcement) and customer-panel documents
  (legal text, dashboard promo, panel announcement) share one model, one
  lifecycle, one revision history and one audit prefix (`admin.website.`).
- The site's typed data stays as the **baseline**. Each page template declares
  the fields it exposes in `web/shared/cms/` — a field DSL that yields both the
  zod schema and the editor form. The site resolves `overlay ?? baseline` field by
  field at render, so an unmanaged field renders exactly as before, and a CMS
  outage renders the last-good snapshot or the baseline. Landing pages are ordered
  lists of validated section types. No raw HTML is stored or rendered.
- `web/shared/cms/` is the one copy of the contract. The panel imports it by
  relative path (`.demo/shared/cms.ts`). ADR-018's "never import panel code into
  the site" stands; the dependency runs the other way, and the module imports no
  Nuxt, Prisma or JWT code.

## 2. Publishing: server-side render per request over cached content

- Managed routes stop being prerendered. The site's **server** fetches published
  content from the panel's public, read-only content API (`/api/site/**`) over
  localhost, caches it for 60 s (`defineCachedFunction`) with a last-good snapshot
  on disk, and falls back to the baseline. The browser never calls the panel:
  the strict CSP (`connect-src 'self'`, `img-src 'self'`) is unchanged.
- Publishing calls the site's `POST /api/cms/revalidate` with a bearer secret
  (`timingSafeEqual`, 503 when unset), which purges the content cache; a publish
  is visible on the next request. Failures are recorded on the document and
  retried by the scheduler; the 60 s cache bounds staleness regardless.
- HTML-level `swr` caching is deliberately **not** used: nuxt-security mints one
  CSP nonce per request and Nitro's route cache replays the stored headers and
  body, so every visitor would share one nonce for the cache lifetime, and the
  module's hash mode only runs at prerender. If render cost is ever measured to
  need it, `swr` can be enabled per route behind a `beforeResponse` plugin that
  swaps the nonce on each hit.
- Scheduling runs on Nitro's scheduled tasks inside the one panel process (every
  minute, idempotent: a conditional update claims each due document; the publish
  is a transaction; the revalidate call runs after commit and is retried).
- Previews are short-lived purpose tokens (`purpose: 'site-preview'`, 30 min)
  that the site exchanges for the draft; `readAuthToken` refuses any purpose
  token as a session. The token travels in the preview URL, so it is short-lived
  and grants a read of one draft only.

## 3. Authorization: the fixed matrix grows, it does not become dynamic

Six permissions (`website.view|edit|media|publish|seo|settings`) and two fixed
roles (Editor, Publisher) join `shared/permissions.ts`. The team matrix, sidebar
padlocks, invites and the 403 wording pick them up from the same array, which is
what ADR-016 was for. Dynamic roles and multiple roles per user are out of
scope; a role lands on `homeFor(role)`, its first permitted destination.

## 4. Media

A separate `SiteMedia` model on the existing upload utilities (UUID keys, `wx`
writes, sanitised names). Content is sniffed by magic bytes, dimensions are parsed
from image headers (no `sharp` in the panel: it is built on Windows and shipped to
Linux), referenced assets cannot be deleted, and the panel serves files publicly
with immutable cache headers (GET and HEAD, because IPX issues HEAD). The site
optimises them through its existing IPX behind a disk cache of the output, since
IPX itself re-fetches and re-encodes on every request.

## 5. Consequences

- The site now has a runtime dependency on the panel, fail-soft to its own
  baseline; deploy order is panel first, then site.
- Every site page is rendered per request (content cached); the sitemap, robots
  and Organization identity are resolved at runtime from CMS settings.
- Schema changes are additive and still applied by hand in production (backup,
  `prisma migrate diff` SQL, copy `schema.prisma`), as before.
- Tests exist for the first time (`node:test`); they are the acceptance evidence
  for each gate.
