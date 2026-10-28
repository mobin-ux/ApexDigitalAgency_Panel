# MEMORY.md — Living project state

> Handoff doc for continuing work in fresh sessions. Update the relevant section
> whenever a page ships, a decision lands, or a blocker appears.
> Last updated: **2026-10-28** (Website CMS, Gate 1 — ADR-021; 2026-10-25 Panel v2: dashboard, New order and My orders revisions; Wallet revision — credit by application, ADR-020; Support revision — call requests and ratings; 2026-10-27 Settings re-check — profile photos, signed-in devices, two-step verification).

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

## Website CMS — in progress (started 2026-10-28)  ⬅ CURRENT WORKSTREAM

The panel becomes the content management system for the public website and
for a few customer-facing panel documents. Design and decisions: ADR-021.
The user settled two choices before the plan was approved: **SSR per request
over cached content** (no HTML `swr`, because nuxt-security would reuse one
CSP nonce for the cache lifetime) and **extend the fixed role matrix** with
Editor and Publisher (no dynamic roles). The site keeps its typed data as the
baseline and renders `overlay ?? baseline`; the contract lives once in
`web/shared/cms/` and the panel imports it by relative path through
`.demo/shared/cms.ts`.

Gates, each one commit (`feat(cms): …`), lint → typecheck vs baseline → tests
→ preview → docs → `graphify update .` → push:

| Gate | Scope | Status |
|---|---|---|
| 1 | Baselines, ADR-021, contract stub, cross-tree import proven, `zod@3.25.76` pinned in `web/` | ✅ |
| 2 | Roles/permissions, audit bucket, sidebar group, `homeFor(role)`, Prisma models + migration SQL, field DSL + templates, settings registry, state machine, purpose tokens, test harness | ✅ |
| 3 | Site refactor: template-typed copy into data (~25 components), core templates, `cms-baseline.ts`, `GET /api/cms/baseline` | ✅ |
| 4 | Documents, publish/unpublish, revisions, preview tokens, `/api/site/**`, site `cms.ts` + proxies + revalidate, editor UI, landing renderer, import | ✅ |
| 5 | Review workflow, scheduling task, key change + redirect, navigation globals, announcement bar, panel content, `credit.applications-open` | ✅ |
| 6 | Media library (sniff, dimensions, GET+HEAD), IPX disk cache, site settings + identity plugin | ✅ |
| 7 | SEO tab, sitemap source, robots hook, redirects middleware, SEO audit | ✅ |
| 8 | Overview dashboard, UX states, a11y, responsive | ✅ |
| 9 | Full verification, docs, deployment notes, final report | ✅ |

**Baselines (2026-10-28, before any CMS code):** `pnpm test:tsc-demo` reports
**56** errors (all in `layers/tairo` and pre-existing template files — the 87
recorded below was an older count); `pnpm web:typecheck` exits 0. Check a gate
against those, not against zero.

**Gate 1 proof:** a temporary `server/api/_cms-probe.get.ts` importing
`~~/shared/cms` answered `{ "version": 1 }` on the panel dev server, so Nitro
bundles files from the `web/` tree by relative path. The probe was deleted.

**Gate 2 shipped (2026-10-28).** Eight roles × seventeen permissions
(Publisher, Editor; `website.*`), the Website sidebar group with its first
screen `/admin/website` and `GET /api/admin/website/overview`, the
`website` audit bucket, `homeFor(role)` (`app/utils/adminNav.ts`, used by
the layout, the `/admin` guard and the invite landing), the five Prisma
models (`SiteDocument`, `SiteRevision`, `SiteRedirect`, `SiteMedia`,
`SiteMediaRef`; pushed locally, production SQL in
`docs/migrations/2026-10-cms.sql`), generic `signPurposeToken`/
`readPurposeToken` (the two-factor pair now delegates), the website
settings registry (`server/utils/website/settings.ts`), and the shared
contract: field DSL (`f.*` → zod + editor form), blocks, links, sections,
SEO precedence, the `landing`/`header`/`footer`/`announcement`/`legal`/
`panel-promo`/`panel-announcement` templates, `resolveDocument()` and the
pure publishing state machine (`workflow.ts`, shared so the UI, the server
and the tests ask one function). Tests: 25 unit (`pnpm test:cms:unit`) and
the first API suite, every website endpoint × every role + the invite →
editor → `/admin` redirect path (`CMS_TEST_URL=… pnpm test:cms:api`).

**Gate 3 shipped (2026-10-28, `67112f0` + the refactor commit).** The
contract describes every page the site renders from code
(`web/shared/cms/pages.ts`: home, services, our-work, insights, about,
contact; per-record service, case-study, article; chrome globals
service-chrome, case-study-chrome, article-chrome; the header template
carries the menu labels and breadcrumb section names, the footer the strip,
columns and legal line). `app/data/cms-baseline.ts` assembles one complete
document per template from the data modules; `GET /api/cms/baseline` serves
the 33 of them (12 fixed, 7 services, 13 case studies, 1 article), each
validated against its template. Every site component now reads its words
through `useCmsContent()` / `useCmsRecord()` (CMS-off path: the resolved
baseline) and `useCmsLink()` turns stored links into `to`/`href`. Proven
by a text-content diff of all eleven pages before and after: identical.
What is editable per template is copy only — prices, counts, routes and the
catalogues (plans, projects, articles, people) stay in code; an article's
body and a case study's chapters are not CMS fields yet.

**Gate 4 shipped (2026-10-28).** The content loop works end to end, over
HTTP, between the two dev servers: import the baseline (33 documents,
published as revision 1) → edit in the panel → preview the draft on the site
behind a 30-minute token → publish → the panel calls the site's revalidate
route → the site shows the change on the next request, with a fresh CSP
nonce per response → unpublish → 404. Panel: `server/utils/website/
{documents,publish,content-api,preview}.ts`, public `/api/site/{manifest,
page?path=,globals,preview/:token}` (cacheable, no Pragma), admin
`/api/admin/website/documents/**` (list, create, detail, save with
optimistic version → 409, transition, revisions, restore, preview-link,
delete) and `import-baseline`; `/admin/website/pages` (list, filters, New
page, Import) and `/admin/website/pages/:id` (Content / SEO / Revisions /
Settings, workflow buttons from `availableActions` filtered by permission,
409 conflict banner, unsaved-change guard). The form is generated from the
template (`AdminWebsiteFields`, with `AdminWebsiteLink/Blocks/Sections`).
Site: `server/utils/cms.ts` (60 s `defineCachedFunction`, disk snapshot in
`.data/cms`, baseline fallback), same-origin `/api/cms/{page?path=,globals,
preview/:token}`, `POST /api/cms/revalidate` (bearer, timingSafeEqual, 503
unset), `useCmsContent/useCmsRecord` now fetch the overlay, `[...slug].vue`
+ `components/cms/*` render landing pages, `preview/[token].vue`,
`error.vue`; prerender and the static noindex rules are gone. Env:
panel `NUXT_WEBSITE_SITE_URL` + `NUXT_WEBSITE_REVALIDATE_SECRET`; site
`NUXT_CMS_URL` + `NUXT_CMS_REVALIDATE_SECRET` (local `.env` files pair the
two dev servers; never committed). Tests: `test:cms:api` has the lifecycle
suite (12 API tests incl. the site checks when `SITE_TEST_URL` is set).

**Gate 5 shipped (2026-10-28).** Scheduling: `publishDue()` in
`server/utils/website/publish.ts` claims each due document by a conditional
update on the exact scheduled revision (so two runs cannot publish twice),
records failures on the document and in the audit log under a `system`
actor, and retries pending revalidations; `server/tasks/website/publish-due.ts`
runs it every minute (`nitro.experimental.tasks` + `scheduledTasks`, one
node-server process), and `POST /api/admin/website/publish-due` is "run
now". Addresses: `PATCH documents/:id/key` moves a page and writes a 301
`SiteRedirect` from the old address when the page was ever live;
`POST documents/:id/duplicate` copies a free page or legal document as a
draft. Navigation: `/admin/website/navigation` lists the six chrome
documents (header, footer, announcement, three page-chrome) with their
state and an Edit link; the site's `LayoutAnnouncementBar` renders the
published announcement above the header (on, with text, inside its window;
dismissable per browser). Panel content: `/admin/website/panel` creates and
lists the Terms, Privacy, dashboard promo and panel announcement documents
and holds the `credit.applications-open` switch (`PUT /api/admin/website/
panel-features`, `website.settings`, audited). `/api/config` now carries
`legal.{terms,privacy}` and `announcement` for everyone and
`dashboardPromo` + `features.creditApplications` for customers, resolved
over `shared/panel-baseline.ts` through a 30 s in-process cache cleared on
publish; the dashboard promo, the legal pages (`ApexRichBlocks`), the
sidenav (`ApexAnnouncementBar`) and the two apply buttons read it, and
`POST /api/credit/application` refuses with 409 while the switch is off.
Verified: the scheduling suite schedules a page a minute out, sees run-now
decline it, waits, sees it published exactly once, then moves it (301) and
duplicates it; the panel-documents suite publishes an announcement, sees it
in `/api/config` signed in and out, unpublishes it, closes applications and
sees the customer refused and an editor denied. API 14/14. On the site, a
published announcement appeared with its link and disappeared when
switched off (the document stays in the payload with `enabled: false`; the
bar is what goes).

**Gate 6 shipped (2026-10-28).** Media: `shared/media-sniff.ts` (magic
bytes for JPEG/PNG/GIF/WebP/PDF, header-parsed dimensions, `collectMediaIds`)
and `server/utils/website/media.ts` (store by UUID with `wx`, replace =
same id + version bump, soft delete refused while any `SiteMediaRef`
exists, GET and HEAD serving with a year's immutable cache); public
`/api/site/media/:id/:version/:name`; admin `/api/admin/website/media`
(list, upload ≤10 × 10 MB with the Content-Length checked first, get,
patch alt/caption, delete, replace, usage); references are synced per slot
(draft on save, published/scheduled on transition and by the scheduler);
published documents carry a `media` index (address, size, alt). Site: the
image module's `/_ipx` handler is shadowed by
`server/middleware/01.ipx-cache.ts`, which runs IPX itself with an http
source on the panel URL and keeps the processed bytes under `.data/ipx`
(`X-Image-Cache: miss|hit`); `/media/**` proxies PDFs; `CmsMedia` renders
`<NuxtImg>` from the index the landing and preview pages provide. Settings:
`GET/PUT /api/admin/website/settings` on the registry (per-key zod, audited
diff), public `/api/site/settings`, the site's `useSiteSettings()` (filled
settings over the `company` baseline) feeding the footer, the three closing
panels and the Organization identity (now defined in `app.vue` at request
time; `schemaOrg.identity` left `nuxt.config`), and a `site-config:init`
plugin pushing name/url/description. Screens: `/admin/website/media`
(grid, upload, detail with usage, replace, delete) and
`/admin/website/settings` (registry-driven, picker for the social image,
robots disallows); the editor's media control is `AdminWebsiteMediaPicker`.
Tests: media sniffing unit tests on hand-built headers; the media/settings
API suite (upload, sizes, SVG and mismatched-extension refusals, 403 for
read-only, HEAD/GET, usage, delete refused, replace → v2, index on the
published document, site image served then cached, settings 400/403/200
and public). About/Contact company facts still read the code baseline
(their derived rows are built at module load); the footer and CTAs are
dynamic. 31 unit, 18 API, 1 site.

**Gate 7 shipped (2026-10-28).** SEO rendered from the document:
`useCmsSeo()` (`web/app/composables`) is the one head call on all eleven
site pages — title, description, robots (with `X-Robots-Tag` on a hidden
page), canonical (the page's own beats the seo module's default; one
`<link>`), og/twitter with the document's social image, else the page's
own (article hero), else the settings default, else the bundled card.
Precedence page → template default (the words the page used before) →
site settings. A case study without a story is `noindex,follow` again
(the static route rule went in Gate 4; this restores it per request).
Sitemap: `server/api/__sitemap__/urls.get.ts` is the only source
(`excludeAppSources`): the code pages, written articles, studies with a
story and the published landing pages, minus anything whose robots say
noindex, with the panel's publish time as `lastmod`. robots.txt: a Nitro
plugin on `robots:config` adds `/preview/`, `/api/` and the
`site.robots.disallow` setting. Redirects: `SiteRedirect` rows through
`server/utils/website/redirects.ts` (source must be typed as a site path,
target a site path or https; a loop is 409; pointing at a redirected
address is flattened to its destination and anything pointing at the new
source is retargeted; a published page at the source is warned about),
admin `/api/admin/website/redirects` (list, create, check, patch, delete;
`website.seo`), public `/api/site/redirects`, and the site's
`server/middleware/00.redirects.ts` (cached 60 s + purged on publish,
301/302, query string kept, assets and APIs skipped). SEO audit:
`seo-audit.ts` over the published documents and redirects — missing or
over-long titles and descriptions, duplicate titles, off-site or invalid
canonicals, noindex pages, redirect loops and chains, a redirect shadowing
a live page, internal links to nothing, library images without alt —
`GET /api/admin/website/seo-audit`. Screen: `/admin/website/seo` (nav
row "SEO & redirects", `website.seo`): redirects with a live check as you
type (the form's own server call), 301/302 as a pressed pair, turn
on/off, edit, remove with an in-row confirm; the audit grouped Fix /
Check / Note with links into the editor. Tests: the SEO API suite (editor
403, `javascript:` 400, self 409, normalised source, loop 409, chain
flattened, duplicate 409, public endpoint cacheable; a hidden page's
robots and canonical on the public document and in the manifest, the
audit naming it, and on the site the header, the meta, one canonical, 301
with the query kept, the sitemap without it, robots.txt with the
disallows; 302 after a patch, off not served, delete → 404, preview
no-store). 31 unit, 22 API, 1 site; both typechecks at baseline; the
eleven-page text diff is identical to the pre-CMS snapshots.

**Gate 8 shipped (2026-10-28).** The overview is a screen you act from:
every tile links to the list it counts (`AdminStatTile` gained `to`),
quick actions show only the screens the signed-in role may open, the
failed-publish / waiting-for-the-site card carries "Retry now" (the
scheduler's job, `POST publish-due`, for `website.publish`), scheduled and
failed rows open the editor, and a "Search and addresses" card counts the
redirects and, for a role holding `website.seo`, the audit's issues
(computed server-side only for those roles, so a reader never sees a count
with no screen behind it). Every website screen renders
`AdminWebsiteLoadError` (the server's reason + Try again) when its fetch
fails, instead of the empty state it used to show. The editor's two
dialogs (leave without saving, confirm an action) and Settings' new leave
guard are `AdminWebsiteDialog`, built on reka's Dialog like the customer
bottom sheet: measured in the browser — labelled and described, focus
moves inside, body scroll locks, Escape closes, focus returns to the
button that opened it. The hand-rolled dialogs had none of that. Settings
now asks before leaving with unsaved values (route change and
`beforeunload`), and Discard still resets. Audit `detailOf` already
covered every `admin.website.*` action the server writes (checked by
diffing the emitted set against the cases). Responsive: zero horizontal
overflow at 375 and 768 on overview, pages, editor, media, settings and
SEO; the pages table scrolls inside its card by design.

Gate 8 gotcha:
- **`AdminStatTile` renders a `<component :is>`** — pass `to` and it is a
  `NuxtLink` with the focus ring; the two other admin screens that use it
  (contracts, payments) are unchanged because they pass none.

Gate 7 gotchas:
- **h3 helpers are not auto-imported in the site's app code**:
  `setResponseHeader` has to be imported from `h3` in a composable, or
  every noindex page 500s in SSR with nothing in the server log.
- **`AdminPageHeader`'s actions are its default slot**, not `#actions`.
  Media's Upload, Pages' "New page" and SEO's "Add redirect" had all been
  rendering nothing; fixed in this gate.
- **The robots module blocks everything in dev** (`Disallow: /`); check
  `/robots.txt?mockProductionEnv`.
- **Normalising a redirect source first is a hole**: `javascript:alert(1)`
  becomes `/javascript:alert(1)`, a "safe" path. Require the typed value to
  start with `/` before normalising.
- The settings API suite sets `site.phone` while it runs and resets it at
  the end; a page snapshot taken meanwhile differs by one footer line.

Gate 6 gotchas:
- **A `server/routes` file cannot override a module's handler at the same
  path**: the router answers with the first registered match. A
  `server/middleware` that handles the path and returns runs first.
- **IPX matches `domains` by hostname, without the port.**
- **A header-only image fixture passes the sniffer but not the resizer**;
  anything the site must render needs a real image (a 1×1 PNG is 67 bytes).
- **`useState`/`useNuxtApp` inside a `useFetch` `transform` fails on the
  server** and turns into a silent fetch error; pass data down with
  provide/inject instead.

Gate 5 gotchas:
- **Nitro tasks need a dev-server restart** to register the cron; HMR does
  not pick up `scheduledTasks`.
- **A panel document's key is a slug, not a path**: `legal` takes `terms` or
  `privacy`; the fixed-key panel templates are creatable once from the
  Panel content screen (the baseline import only creates site documents).
- Checking "the bar is gone" means checking its control, not its text: the
  disabled document still travels in the SSR payload.

Gate 4 gotchas:
- **A Nitro catch-all route cannot match the root**, so a page's address is
  a query parameter (`?path=/`) on both the panel route and the site proxy.
- **A runtime-config key must match its env name**: `cms.secret` read
  `NUXT_CMS_SECRET`, not `NUXT_CMS_REVALIDATE_SECRET`; the key is
  `revalidateSecret` now. Symptom: every publish reported
  `revalidated: false` and the site showed a change only after 60 s.
- **unstorage's fs driver turns a `/` in a key into a directory** it may not
  create; snapshot keys are flattened, and a failed snapshot write no longer
  counts as a failed fetch.
- **`defineCachedFunction` caches a null** (no document) for its `maxAge`;
  the revalidate purge is what makes a first publish visible at once.
- **The landing page must `await` its fetch**: the page decides 404 from the
  answer, and a composable's `useFetch` is only auto-awaited for the render,
  not for the setup code after it.
- **Vue templates cannot hold a TypeScript cast inside an object spread**
  (vue-tsc stops with TS1109); writes like that live in a method.
- **`$fetch` with a URL built at runtime blows the typed-route inference**
  (TS2321 excessive depth); the site's cache module uses native `fetch`.
- **Deleting is for never-published drafts only, even after an unpublish**:
  the workflow reads `everPublished` (any revision with `publishedAt`).
- Dev noise: the panel console shows three 500s on every admin page from the
  Tairo component-meta loader on Windows — pre-existing, not the CMS.

Gate 3 gotchas:
- **The baseline endpoint is the mismatch detector.** It validates every
  document before serving; two template caps were wrong on first run
  (search description 160 → 200, a switched-off announcement may have no
  text). Run `SITE_TEST_URL=… pnpm test:cms:site` after changing a
  template or a data module.
- **`defineCachedEventHandler` keeps serving for its `maxAge` across HMR**;
  wait it out (60 s) when a changed baseline seems not to appear.
- **A per-record page merges the overlay into the catalogue record** in the
  page (`services/[slug].vue`, `our-work/[slug].vue`, `insights/[slug].vue`)
  so the section components keep their `page`/`study`/`article` props.
- Function-valued copy (`byline(role, minutes)`, `since(year)`,
  `ctaEyebrow(service)`) is a placeholder string in the template, filled
  with `fill()` where the component used to call the function.

Gate 2 gotchas:
- **The panel's Nuxt 3 tsconfig refuses `.ts` extensions in imports**
  (TS5097); the site's Nuxt 4 one allows them. `.demo/tsconfig.json` now sets
  `allowImportingTsExtensions`. The extensions are needed so `node --test`
  can load the contract without a bundler.
- **ESLint auto-fix rewrites `node:test` imports to `vitest`**
  (`test/no-import-node-test`); each suite carries a disable comment.
- **The sign-in limiter blocks a test run** (5/min, then 15 min): the
  dev-only `POST /api/_test/reset-rate-limits` is called before each login.
- **This checkout's `dev.db` has no Phase 9 staff seeds**; the harness
  invites `cms-test-<role>@example.test` on first use instead.
- A heredoc through the shell hook strips backslashes inside JS regexes —
  write edit scripts to the scratchpad and run them with node.

**Gate 9 (2026-10-28).** Regression smoke over 19 admin routes (owner
200; customer 302 to the dashboard), 8 customer routes (200), the
anonymous redirects, 14 site addresses (200, the unknown one 404), the
audit partition (430 rows = the seven kinds summed, 0 double-counted) and
the team matrix (eight roles rendered). Site SSR HTML has no style
attributes; the nine the browser shows in dev are Nuxt devtools, the vue
tracer and the route announcer. Lint over every file the workstream
touched (212, in chunks — the list exceeds Windows' command line), both
typechecks at baseline, 31 unit + 22 API + 1 site. Docs:
`docs/DEPLOYMENT.md` §9 (schema, env keys, order, first-run import,
rollback), `docs/REQUIREMENTS.md` §1b and three gap rows,
`DESIGN_SYSTEM.md` (Website module standards), `docs/ARCHITECTURE.md`
(API table). The site's production build **failed first**: Vite externalised the
relative `../../shared/cms` imports and Nitro could not resolve them from
its chunk directory (`Could not resolve "../../../../../../../../shared/cms/
index.ts"`). Every site import of the contract is `#shared/cms` now — the
alias Nuxt bundles for both halves, which `#shared/contact` had already
proven in the deployed build; the tests keep their relative `.ts` imports
for `node --test`. The rebuild passed (1038 s here, 33 MB `.output`) and
the built server, run on :3100 against the panel, answered pages 200, a
redirect 301, the sitemap (21 addresses), robots.txt with the disallows,
X-Robots-Tag on a summary case study, a fresh CSP nonce per request and
404 for an unknown address. That smoke also caught a bad preview token
rendering a 200 page titled "Preview: undefined": `ignoreResponseError`
handed the proxy's 404 body to the page as a document. The page reads the
fetch error now and answers 404 (the API suite asserts it).

Gate 9 gotchas:
- **`ignoreResponseError: true` turns an error body into `data`.** A page
  that decides 404 from "no document" must read `error` from `useFetch`,
  or an error object passes as a document.
- **Import `web/shared` through `#shared/…` in the site's app and server
  code, never by relative path.** Dev resolves both; the production server
  build externalises the relative form and breaks in Nitro. Only tests use
  the relative `.ts` path.

## Mail provider — in progress (started 2026-10-28)  ⬅ CURRENT WORKSTREAM

The panel gets outgoing email: Resend over REST (the site's contact form
already uses it), behind a durable outbox. Design and decisions: ADR-022.
Settled with the user on 2026-10-28: soft email verification at signup
(nothing blocked), every in-app notification also emailed behind one
per-account switch, the three missing notifications added (customer reply
→ assignee, files released → customer, new order → `work.assign` staff),
and the invite, reset and CMS review flows emailed. Plan file:
`~/.claude/plans/inherited-prancing-treehouse.md`.

| Gate | Scope | Status |
|---|---|---|
| 1 | `MailMessage`, `server/utils/mail/*`, `mail:deliver` task, `runtimeConfig.mail`, startup checks, `features.mail`, `/api/admin/mail` + `/admin/mail`, dev `_test/mail`, ADR-022, DEPLOYMENT §10 | ✅ |
| 2 | Password reset, soft email verification (banner, page, purpose token), invites emailed with an honest fallback, recover page copy | ✅ |
| 3 | `notify()` helper over the 16 call sites, `User.emailNotifications` + Settings switch, the three new notifications, copy fixes | ✅ |
| 4 | CMS review emails (`SiteDocument.submittedById`), docs sweep | ☐ |

**Gate 1 shipped (2026-10-28).** Outbox rows are rendered at enqueue
(text + escaped HTML from one `MailContent` shape), tried once right after
the business write and retried by the task every minute (1, 2, 4, 8, 16,
32 min, six attempts; a stale SENDING row is reclaimed after two minutes;
SENT rows pruned after 30 days, FAILED after 90). `Idempotency-Key` is the
row id. With no key every row goes FAILED "Mail is not configured" and the
Email screen (System → Email, `team.manage`) names the two env keys;
"Send a test email to me" goes through the real outbox. A reset or
verification row is never retryable (dead link). Tests: 8 unit (render
escaping, `absoluteUrl`, backoff, templates), 5 API (403/401, 409
unconfigured, 404/400, `_test/mail`, `features.mail`). **Production needs
`docs/migrations/2026-10-mail.sql` and, once the domain is verified in
Resend, the two keys (DEPLOYMENT §10). Not deployed.**

**Gate 2 shipped (2026-10-28).** `server/utils/mail/flows.ts` holds the
three account emails (`queueVerificationMail`, `queuePasswordResetMail`,
`queueInviteMail`), each taking the caller's transaction client; a link
that cannot be built (no public origin in production) becomes a FAILED
row with that reason instead of an exception. Reset: the token is queued
with the `PasswordResetToken` row and never logged (the console line is
gone). Verification: a purpose JWT (`verify-email`, 24 h, claims
`uid` + `email`) — `POST /api/auth/verify-email/request` (signed in, 3 per
quarter hour) and `POST /api/auth/verify-email` (no session, idempotent,
`updateMany` on `verifiedAt: null`, audit `auth.email.verify` in the
Access bucket); signup queues it for email identifiers; `/api/auth/me`
returns `verifiedAt` and `phone`; `ApexVerifyEmailBanner` in the customer
shell (only when `features.mail`, hide for the session) and
`/auth/verify-email`. Invites: the answer carries `mail.status`; the team
page says "Invitation emailed" or hands the link over with the reason,
and the modal footer reads `features.mail`. Recover: with `features.mail`
false the request form is replaced by the support address. Tests: the
`auth-mail` API suite (signup → link from `_test/mail` → verified once →
second click still a success; reset → link → new password → sign in,
unknown address answers identically and queues nothing; invite and
resend answer FAILED "Mail is not configured" on the keyless server with
the emailed link equal to the returned one).

**Gate 3 shipped (2026-10-28).** `server/utils/notify.ts` — `notify({
userIds, title, message, type?, link?, always?, excludeUserId? }, tx?)`
writes the Notification rows and queues `notificationMail` for accounts
with an address that kept `User.emailNotifications` (new column, default
on) on; `always` for account notices; a suspended account gets the row and
no email; `notifyRoles(permission, …)` resolves the staff holding a
permission (plus accounts with no `staffRole`, the owner fallback). The
rules are a pure `selectRecipients()` in `notify-rules.ts`. Every one of
the sixteen inline `prisma.notification.create` sites went through it
(the dev seed is the one left); `chargeInstallment`, `collectKickoff` and
`settleIntent` pass their transaction client and deliver after the
commit. Three notifications that did not exist: a customer reply reaches
the assignee, else the order's manager, else everyone holding
`support.answer` (`/admin/tickets?ticket=`); releasing a project's files
tells the client "Your files are ready"; a new signed order goes to
`work.assign` holders instead of every ADMIN account. Customer Settings ›
Notifications has the real switch (`PATCH /api/settings/preferences`
`emailNotifications`; `/api/auth/me` returns it), with the line saying
whether the panel can send at all; phone-only accounts are told to add an
address. Copy fixed: the wallet mandate screen no longer promises an
email unconditionally, the Tools broadcast says it emails and drains at
fifty a minute, and `web/.env.example` had the site's FROM address on the
CMS secret line. SQL: a hand-written `ALTER TABLE "User" ADD COLUMN`
(Prisma proposed a table rebuild differing only in column order). Tests:
3 unit (recipient rules), the `notify-mail` API suite (customer reply →
owner's in-app row + queued email; switch off → row, no email; broadcast
reports `emailed`; an off-site link is 400).

Gate 3 gotchas:
- **eslint-plugin-unicorn still crashes on `server/payments/*`**; lint that
  file with `--rule "unicorn/error-message: off"` (it then auto-fixes the
  import order), never in the main list.
- **The dev server keeps the Prisma client it started with**: after
  `db push` + `generate` for a new column, restart it or every select of
  the column is "Unknown field".

Gate 2 gotchas:
- **Queue inside the caller's transaction with the caller's client.** The
  first invite run timed out at 5 s: `queueInviteMail` read settings and
  wrote the outbox row through the main Prisma client while the invite's
  own transaction held SQLite's write lock. Every flow and `enqueueMail`
  take a `Db` (the transaction client or `prisma`); `loadBrand(db)` too.
- **A fire-and-forget delivery leaves the row QUEUED for a moment**; a test
  polls `_test/mail` until the status settles instead of asserting at once.
- **A route that answers two shapes breaks the typed `$fetch`**: pages
  reading `result.mail` failed vue-tsc until the verification request
  route returned `mail: DeliveryOutcome | null` on both branches.

Gate 1 gotchas:
- **Nitro auto-imports nested `server/utils/**` files too.** A barrel
  `index.ts` re-exporting the mail module duplicated every name in
  `#imports` (a warning per export) and the scanner then served a stale
  export list ("MAX_ATTEMPTS is not exported by outbox.ts") until the dev
  server was restarted. No barrels under `server/utils`.
- **The RTK shell proxy swallowed `pnpm exec prisma db push`** ("Binary
  'prisma' not found") and reported nothing; the table was missing until
  `node node_modules/prisma/build/index.js db push` ran. Check with
  `prisma migrate diff --from-url file:./prisma/dev.db --to-schema-datamodel
  prisma/schema.prisma --script` (empty = in sync).
- **A migration SQL file comes from a copy of the pre-change DB:** copy
  `dev.db` before `db push`, then `migrate diff --from-url file:<copy>`.

## Production deploy — 2026-10-28 (panel: Panel v2 → CMS; site: CMS)

On the user's go-ahead ("Deploy both"). The live panel had been on the
Phase 9B schema since 2026-10-20, so this deploy carried **everything from
Panel v2 onward** (client actions, credit applications, sessions, two-step,
avatars, the Support revision and the CMS) in one additive migration.

- **Schema:** `prisma migrate diff` from the live `schema.prisma` to the
  repo's, applied with the panel stopped for a few seconds: 8 `ADD COLUMN`
  (User, Company, Transaction, Ticket), 9 new tables (ClientAction,
  CreditApplication, Session, TwoFactor, the five `Site*`), and Project /
  Installment / Attachment redefined with every existing column copied
  (every required column without a default was in the copy list, checked
  before running). Integrity ok, row counts identical (5 users, 5 projects,
  5 instalments, 14 transactions), 28 → 37 tables. Backup
  `/opt/apex/backups/dev.db.20261028-105726.pre-cms`, the SQL beside it as
  `migration-20261028-105726.sql`. The four `foreign_key_check` rows
  (LedgerEntry → missing PaymentIntent) are identical in the pre-Phase-9
  backup: pre-existing, not this migration.
- **Env:** panel gained `NUXT_WEBSITE_SITE_URL`, `NUXT_WEBSITE_REVALIDATE_SECRET`,
  `NUXT_WEBSITE_MEDIA_DIR=/opt/apex/site-media`, `NUXT_UPLOAD_DIR=/opt/apex/uploads`
  (`NUXT_ENCRYPTION_KEY` was already there); site gained `NUXT_CMS_URL` and
  `NUXT_CMS_REVALIDATE_SECRET`. The secret was generated on the box and
  never left it. Both directories exist, owned by `apex`.
- **Panel** shipped with `ship-bundle.sh` (167 MB, health 200, Stripe live
  keys intact). **Site** shipped with `ship-web.sh` (built on the box,
  health 200). Verified on the box: `/api/site/*` public and cacheable,
  site pages 200, `/preview/x` 404, robots.txt with `/preview/` and
  `/api/`, sitemap 15 addresses, a fresh CSP nonce per request,
  `X-Robots-Tag` on a summary case study, `GET /api/cms/baseline` → 33
  documents, revalidate 401 without the secret and `{ok,purged:9}` with
  it, the site reading the panel's (empty) settings, both journals clean,
  both sslip hosts answering through Caddy.
- **Still to do by hand:** sign in as the owner and run **Website → Pages →
  Import current site content** (no owner credentials are known here);
  until then the site renders its code baseline, which is identical. Then
  invite the editors.

**Deployed now:** everything on master up to this commit. Never deploy the
panel or the site without the user's go-ahead. Deploy order and every key:
`docs/DEPLOYMENT.md` §9.

## Panel v2 — `Panel Breakpoints.dc.html` (2026-10-24)

The customer panel was redesigned again as "Panel v2": six pages (Dashboard,
New order, My orders, Wallet, Support, Settings) in one new shell, light by
default with a dark toggle, checked at 393 / 768 / 1024 / 1440px. The source is
the Claude Design project `19ec9d54-…`: `Panel Breakpoints.dc.html` frames the
six `*.dc.html` pages, which are assembled from `_build/shell.html|js` and each
`_build/<page>.main.html|js` — read those, they are smaller and unrendered.

**Shell** (`layouts/sidenav.vue`, customer only — admin still uses `DemoToolbar`):
260px sidebar from 1200px (`desk:` breakpoint), 88px labelled rail from 768px,
60px bar + five tabs below. No drawer on a phone; Settings lives in the account
sheet. Theme toggle in the bar, the account menu and Settings › Appearance
(`useApexTheme`). The document scrolls, not an inner `<main>`.

**Theme tokens** (`main.css`, `@theme inline`): `bg-page/card/raised/chrome/glass`,
`text-fg-heading/body/muted/accent`, `border-line-subtle/soft/rule/strong`,
`accent/-ink/-tint`, `st-<tone>-bg/-fg`, `shadow-panel/-pop`. Light values on
`:root`, dark on `.dark, .apex-dark` — `.apex-dark` makes a navy island (the
dashboard's pay-monthly band) inside a light page. Three values differ from the
design system for AA, measured: light success text #137050, dark success
#2BC48D, dark violet text #AE96F9 (the DS values were 3.7 / 4.5 / 4.2 on their tints).

**Admin, auth and legal stay dark**: `pages:extend` in `nuxt.config.ts` pins
them with `meta.colorMode`, because they were only ever checked in dark.

**Layouts follow the content width, not the viewport**: each page wrapper is
`@container` and uses `@min-[720px]:` etc., matching the design's `contentW`.

**Backend behind it (ADR-019 and below):**
- `shared/catalog.ts` — the website's seven services and plans, and
  `orderTerms()`; the wizard and `POST /api/orders` both price with it.
  Setting `catalog.v2`; `/admin/services` edits it (prices and copy only).
- **No deposits since 2026-10-25** (New Order revision, ADR-019 amendment):
  fixed plans are n equal payments, payment 1 at kickoff, counted on the plan.
  A deposit is now an optional admin catalogue field. The website still
  quotes deposits — open.
- **Credit by application since 2026-10-25** (Wallet revision, ADR-020):
  `CreditApplication`, the form at `/dashboards/wallet?credit=apply`, staff
  decide at `/admin/credit`. Lines that existed were kept. No line = one fixed
  monthly plan at a time (`creditAllows`). Open: document retention after a
  decision, and a legal check on lending to sole traders.
- Orders are signed, not charged: `PENDING` + `kickoffAmount`. Staff press
  "Kickoff done · collect £X" on the admin project screen
  (`POST /api/admin/projects/:id/kickoff` → `collectKickoff()`); plans are
  `pending` until then, so auto-pay cannot take a monthly payment first.
- `ClientAction` — "Waiting on you". Staff ask from the admin project screen;
  the client answers on My orders (`/api/orders/:id/actions/:id/complete`).
  The dashboard also lists support requests awaiting the client's reply and
  orders whose kickoff call is not yet arranged.
- **Uploads exist now**: `POST /api/uploads` (20 MB, allow-listed types, no
  SVG/HTML, stored by UUID under `NUXT_UPLOAD_DIR`, default `.data/uploads`),
  `GET /api/attachments/:id` (uploader, owner or permitted staff, else 404).
  Used by the New order brief, My orders › Files and Support.
- Support: customers resolve/reopen (`PATCH /api/support/:id`), topics
  project/billing/account/other, an order link, attachments. The ticket list
  no longer leaks internal notes as the preview line (it did).
  **Support revision (2026-10-25):** hub / thread / 3-step form; the
  "account manager" card is the newest active order's project manager;
  "Request a call" files a support request with `Ticket.callSlot` that staff
  confirm by replying (no calendar); resolved requests take a 1–5 rating;
  requests about an order are assigned to its manager; a public staff reply
  notifies the customer.
- **Profile photos (Settings re-check, 2026-10-27):** `Attachment.avatarUserId`,
  `PUT`/`DELETE /api/settings/avatar`, `GET /api/avatars/:userId` (self and
  staff only). `User.avatar` = `/api/avatars/<id>?v=<file>`; any other value
  is treated as no photo. `ApexPanelAvatar :person` renders it everywhere.
- **Sessions and two-step (2026-10-27):** `Session` (one per sign-in; JWT
  carries `sid`; `middleware/02.session.ts` refuses revoked ones),
  `User.sessionsValidAfter` (ends pre-session tokens), `TwoFactor` (TOTP
  secret encrypted with `utils/crypto`, backup-code hashes, `lastStep`).
  Login answers `{ status: 'two_factor', ticket }` when on; the page finishes
  at `/api/auth/login-2fa`. Staff reset: `POST /api/admin/users/:id/two-factor-reset`.
  New dependency `uqr` (QR), pinned 0.1.3.
- `Company.companyNumber` + Companies House lookup
  (`/api/settings/companies-house`, needs `NUXT_COMPANIES_HOUSE_KEY`; the
  button is hidden without it). `Project.status` gained `IN_REVIEW`.
- `GET /api/dashboard/overview` feeds the dashboard in one call.
- One password minimum, now 12: `shared/password.ts`.

**Deliberate deviations (real or absent):** no saved-card "Pay from" option
(instalments are wallet-only); no auto top-up switch (the real auto-pay
instalments switch is shown instead); no invoice download per payment (no
invoice document exists); no 2FA switch, device list or email-notification
toggles (none exists; the page says so); the sign-in email is read-only (no
mail provider to confirm a change); nothing claims to have emailed anything;
no fake "Apex support" auto-reply on a new request; the FAQ tab is gone, as drawn.

**Deploy needs:** `prisma db push` (new columns + `ClientAction`, and
`CreditApplication` + `Attachment.creditApplicationId` from ADR-020, and
`Ticket.rating`/`ratingNote`/`ratedAt`/`callSlot` from the Support revision, and
`Attachment.avatarUserId`, `Session`, `TwoFactor` and `User.sessionsValidAfter`
from the Settings re-check), `NUXT_ENCRYPTION_KEY` (two-step secrets are
encrypted with it, falling back to the JWT secret), a writable
`NUXT_UPLOAD_DIR` outside the bundle (e.g. `/opt/apex/uploads`), optionally
`NUXT_COMPANIES_HOUSE_KEY`. Not deployed yet.

**Dashboard revision (2026-10-25).** `Dashboard.dc.html` changed after the
Breakpoints build: new promo copy with no pickers, three credit states, and a
redesigned notifications panel (filter, per-row read). Details and deviations
in DESIGN_SYSTEM.md. Open: the `Notifications.dc.html` page is not built (the
credit application flow was built in the Wallet revision).

**Local test data:** order "E2E site" (Website Design Starter) on
`user@apex.com`, kickoff collected after a £500 admin wallet credit, one
answered client action, one uploaded file. Local only.

## Public website — `web/` (started 2026-10-15)

The panel phases are done; the current work is the public marketing site,
designed in the same Claude Design project (`47bcb520-4a3f-437a-b108-9cc02e4acec9`:
`Homepage`, `About`, `Services`, `ServicePage`, `Service - Website Design`,
`Our Work`, `Case Study`, `Insights`, `Article`, `Contact`). It is a **separate
Nuxt 4 app** (`@apex/web`, run with `pnpm web:dev`) with its **own lockfile and
node_modules** — run `pnpm install` inside `web/`, never add it to the root workspace — see ADR-018 and
`web/README.md`. Nothing in it touches Prisma, JWT or the payment code.

| Page | Status |
|---|---|
| Homepage (`/`) | ✅ built — all 9 sections, responsive 390 → 1440, strict CSP, JSON-LD (Organization + WebPage/FAQPage) |
| Services (`/services`) | ✅ built — goal filter (`?goal=` deep link), 7 cards, combinations, ordering steps, CTA; JSON-LD CollectionPage + ItemList + BreadcrumbList |
| Website Design (`/services/website-design`) | ✅ built — all 11 sections, 12/6-month plan switch, comparison table, local logo sprite; JSON-LD Service + Offers + FAQPage |
| SEO, PPC, Digital Marketing, Software, UI/UX, Branding (`/services/<slug>`) | ✅ built from `ServicePage.dc.html` + `service-data.js` — one content file each, a bespoke hero drawing each, monthly or scoping plans |
| Our Work (`/our-work`) | ✅ built — featured study, service + sector filters (`?service=&sector=` deep links), 12 project cards, client quotes, CTA; JSON-LD CollectionPage + ItemList |
| Case Study (`/our-work/[slug]`) | ✅ built — Hartley & Sons in full (facts card, results band, sticky contents list with scroll highlight, four chapters, monthly chart, quote, services used, CTA, similar projects); the other 12 studies get a `noindex` summary page so no card 404s; JSON-LD Article + BreadcrumbList |
| Article (`/insights/[slug]`) | ✅ built — the website cost guide in full (answer-first summary box, sticky contents list with scroll highlight, price table, checklists, costs grid, quote, inline service card, FAQ, method note, author), closing CTA and "Keep reading"; CSS-only reading bar in the header; JSON-LD Article (Person author) + FAQPage + BreadcrumbList |
| About (`/about`) | ✅ built — hero with three figures, four promises, team with a department filter, company paperwork card, timeline, studio card, CTA; JSON-LD AboutPage + BreadcrumbList. Unconfirmed company facts are hidden, not printed |
| Contact (`/contact`) | ✅ built — hero with three figures, message form (services, budget, fields, reply method) posting to `POST /api/contact`, side panel, studio card, FAQ; `?service=&plan=` from service pages names the plan; JSON-LD ContactPage + FAQPage + BreadcrumbList |
| Insights (`/insights`) | ✅ built — hero with search (`?q=`), featured article beside "Coming soon", topic chips (`?topic=<service>`) over every catalogue article, quick price answers, CTA; JSON-LD CollectionPage + ItemList (written articles only) |
| Legal, careers | ☐ not built — every link already points at its final URL (`app/data/routes.ts`) |

**Last site deploy: 2026-10-27** (`aaf767e`, the Insights page) — build ok,
health 200; `/insights`, the cost guide and the sitemap checked on the box.
HTTPS to the sslip.io host timed out from the dev machine that day while SSH
worked, so verify on the server (`curl 127.0.0.1:3100`) when that happens.

**Deployed 2026-10-20** to the same VPS as the panel (146.19.130.11).
`bash scripts/ship-web.sh` uploads `web/` source, builds ON the server (~30s;
it must, because `sharp` is bundled per platform), swaps `/opt/apex-web/.output`,
health-checks and rolls back. `apex-web.service` runs it as user `apex` on
127.0.0.1:3100; Caddy serves `apexdigi.co.uk` (+ `www` → apex) and the
preview `site.146-19-130-11.sslip.io`. Runtime env is `/opt/apex-web/.env`
(the `NUXT_CONTACT_*` keys are still empty, so the form shows its
"not sent, email us" fallback). **`apexdigi.co.uk` expired on 2026-08-06 and
is SUSPENDED at names.co.uk (NS: Cloudflare)** — nothing under it resolves,
the panel subdomain included, until it is renewed; Caddy then issues the
certificates by itself.

**Open items for the homepage:** real client logos, case-study and article
photography (`MediaFrame` already takes an image), the real phone number,
Companies House and VAT numbers (`app/data/site.ts` — empty strings hide their
UI), social profile URLs, and the legal pages. The contact email in the design
is `ceo@digiapex.co.uk` while the domain is `apexdigi.co.uk`; confirm which.

**Services page decisions**
- The goal filter is progressive: the prerendered HTML lists all seven
  services; `?goal=` is read in `onMounted` (a prerendered page is one file
  for every query string). Cards animate in only after a filter change, so
  first paint never waits on an animation — the preview pane freezes the
  animation timeline, which is how this surfaced.
- Service facts (summary, fixes, best for, timeline, goals) live on the one
  `services` record; page-only copy is in `data/services-page.ts`.
- The combination prices (£239, £649) come from the design and are lower
  than the sum of the from-prices — `TODO(content)` to confirm.
- "Create your account — Email and business name" was untrue (signup asks
  for a name and email), so it reads "Your name and email" here and on the
  homepage.
- The software card's "Book a call" is a real link to `/contact`, raised
  above the card's stretched link; the other cards' CTAs are decorative.

**Service page decisions**
- `/services/[slug]` is generic: sections render from
  `data/service-pages/<slug>.ts` (shape in `types.ts`, mirroring the design's
  `service-data.js`). The other six services need only a content file.
- Plans live once in `data/plans.ts`; the homepage explainer derives from it.
- "Start your order" opens the panel's New Order with
  `?service=web&plan=&term=`. **The panel reads only `service`, prices from its
  own catalogue on 12/24 months with no deposit, and its auth guard drops the
  destination for anonymous visitors** — so the site's plans and the panel's
  checkout disagree until the panel is updated.
- Logos are a local sprite (`pnpm icons`), never the design's CDN hot-links
  (CSP `img-src 'self'`, and no visitor IPs to third parties).
- Testimonials, named clients and case-study figures are the design's —
  `TODO(content)` to confirm each is real and consented (DMCC Act 2024).

- **Fidelity audit (2026-10-18).** Re-checked against `Service - Website
  Design.dc.html` (unchanged since 2026-10-11): all 340 visible design strings
  are on the page except the three placeholder footer numbers. Two shared
  fixes: the offering, technology, proof and FAQ headings are the designs'
  44px (`UiSectionHeader size="md"`), and the offering block's top padding
  is per design — `offering.spaced: true` for Website Design, none on the
  six `ServicePage.dc.html` pages, which run it on from the audiences.

**Generic service pages (`ServicePage.dc.html`)**
- Every plan catalogue lives in `data/plans.ts` (`seoPlans`, `ppcPlans`,
  `marketingPlans`, `uxPlans`, `brandPlans`), and `services.ts` takes each
  service's "from" price from it, so the menu, cards and pages cannot drift.
  Card billing lines ("£199 deposit, then 6 × £249", "No set-up fee ·
  6-month minimum") are written by `billingNote()` from the figures.
- Plans come in three forms: `terms` (Website Design), `monthly` and
  `scoping` (Software: free call → £2,400 discovery → quoted build).
- **Monthly plans' "Start your order" opens `/contact?service=&plan=`**, as the
  design says: the panel's wizard does not sell retainers or 6-payment plans,
  so sending SEO or PPC visitors there would sell them the wrong product.
  Website Design still opens the panel.
- Design errors corrected rather than copied: Branding's proof said "£1,643
  total, over six months" — the Identity plan is £249 + 6 × £249 = **£1,743**,
  now derived; Branding's intro said "six equal monthly payments" though
  Brand + Web runs twelve.
- Ahrefs and Klaviyo are not in Simple Icons (the design's CDN links would
  have been broken images), so their chips are name-only, like LinkedIn.
- The hero drawings' mock data (search terms, ad copy, quote lines) is part
  of each drawing component, not page copy; the drawings are `aria-hidden`.
- `success-ink` darkened to `#167d58` (4.6:1 on `success-50`); the old value
  was 4.49 on its own tint.

**Our work page decisions (`Our Work.dc.html`)**
- Projects live in `data/case-studies.ts` (typed `CaseStudy`, sectors,
  service slugs); page copy in `data/our-work.ts`. Each card links to
  `/our-work/<slug>`, served by the Case Study page.
- The design's two prototype switches (2 or 3 columns, "single figure"
  metric) were dropped for its defaults: three columns, before → after.
- Filter chips count within the other row's selection, as designed, and a
  pressed chip toggles off. `UiFilterChip` is shared with the services finder.
- Track-record figures are one place each in `site.ts`: `projectsDelivered`,
  `averageEnquiryLift` (3.1×) and `reviewRating` (5.0 on Trustpilot; an empty
  score hides every rating). No `AggregateRating`/`Review` markup: Google
  ignores self-served reviews on a business's own site.
- Stars are `UiStars` (SVG, decorative, `amber-500` = the DS's
  `--apex-warning`); the score is always written out beside them.
- **Content conflicts to resolve (TODO(content))**: Hartley & Sons is
  "+214% enquiries, 4.2× ROAS" on the homepage, "4.2× quote requests" here
  and "29 quote requests a month" in the Case Study design; "Priya Shah" is a
  partner at a family law firm on the SEO page and at Northgate Accountants
  here; the service pages' case studies (Brightwire, Keystone …) are not in
  this list. One catalogue should hold every study once they are real.

**Case study page decisions (`Case Study.dc.html`)**
- One dynamic page, `/our-work/[slug]`, over the catalogue. A study with a
  `story` renders the design in full; one without renders hero, its single
  result, CTA and similar projects, and is `noindex, follow` via route rules
  (so it is not in the sitemap). Write a `story` and it becomes indexable.
- Hartley & Sons is now a catalogue entry (`hartleyAndSons`), and the Our work
  featured card reads its client details from it. Figures left as the design
  has them, at the user's request (2026-10-17), pending the real numbers.
- **More design conflicts (TODO(content))**: the results band says 29 quote
  requests a month "averaged over six months" but the chart's last six months
  average 27; the facts card says "Growth · £149/month" while Growth is £299 —
  the plan line is derived from the £149 Starter plan, which the page's two
  "From £149" prices also quote.
- "Similar projects" uses each study's `related` slugs when set (Hartley: the
  design's Ashby, Stonebridge, Harbour), otherwise same sector first, then
  most services in common. Cards are `WorkProjectCard compact`.
- The chart is HTML bars with an `sr-only` data table. Bar heights are
  `h-[N%]` classes generated by `@source inline('h-[{1..100}%]')`, because
  the strict CSP blocks style attributes.
- CTAs follow the design: "Start your order" and the side panel open
  `/contact?service=<lead service>` (two services cannot go through the
  panel's single-service checkout). The "Live in …" check is shown only when
  the lead service is Website Design; SEO's timeline is a duration.
- The header marks "Our work" `aria-current="true"` on case-study pages
  (`"page"` stays for the section page itself).
- Article markup has no `datePublished`: no study carries a real date yet.

**Article page decisions (`Article.dc.html`)**
- One catalogue, `data/articles.ts`. A body is sections of typed blocks, so
  the next article is a data file. Entries without a body are teasers (the
  homepage list and the design's "Keep reading"); their URLs 404 until
  written, and only written articles are prerendered and in the sitemap.
- The homepage lead teaser now reads the cost guide's title, reading time
  (9 min) and date from the catalogue; its category is the article's topic
  ("Websites", was "Pricing"). Published 2026-03-01 (the homepage's date),
  updated 2026-09-14 (the article's) — both go into the markup.
- **TODO(content), and more serious than the case-study figures:** the
  article presents a survey ("120 quotes from 64 agencies and 56
  freelancers") as research, names an author (James Cole, Head of Web, "200+
  builds") and says ownership "transfers once the final payment clears",
  which contradicts the Website Design page ("you own everything"). All
  design copy, all to confirm before launch.
- Reading progress is a CSS scroll-driven animation (`animation-timeline:
  scroll(root)`), hidden where unsupported and under reduced motion — no
  script, and no style attribute for the CSP to block.
- Share links are plain LinkedIn/X share URLs (no third-party script); "Copy
  link" says "Copy failed" when the clipboard refuses (it does in the hidden
  preview tab).
- The price table is a real `<table>` with a caption; FAQ is native
  `<details name>` with the first open, as designed.

**About page decisions (`About.dc.html`)**
- The design's placeholders are not printed. `site.ts` gained `icoNumber`,
  `insurance`, `address.street`, `address.postcode` (all empty) plus
  `incorporated` ('2024') and `openingHours`. Paperwork rows, their register
  links (Companies House, HMRC VAT check, ICO), the three ticks, the studio
  address, phone and "Get directions" each render only when their fact is
  filled. Today the paperwork card shows two rows: registered name and
  incorporation year. Fill `site.ts` and the rest appears.
- Confirmed street address and postcode flow into the Organization JSON-LD;
  the unconfirmed founding year deliberately does not.
- "Request it" is a `mailto:` with a subject, so it works before /contact
  exists. Team LinkedIn buttons are hidden while their URLs are empty, and
  the team-photo caption appears only once the photo does.
- Team size ('14') is `teamSize` in `site.ts`, shared by the hero and CTA.
- **TODO(content)**: the eight named staff (and consent for photos), the
  timeline, the two open roles. James Cole, the cost guide's author, is not
  on the team list; promise 04 ("you own it from day one") contradicts the
  cost guide's FAQ (ownership after the final payment).

**Contact page decisions (`Contact.dc.html`)**
- The form really sends. `POST /api/contact` (the site's one write — ADR-018
  §4) validates with `shared/contact.ts`, the same validator the page uses,
  and emails the team through Resend. **It needs `NUXT_CONTACT_RESEND_API_KEY`,
  `NUXT_CONTACT_TO` and `NUXT_CONTACT_FROM` in production**; without them it
  answers 503 and the form says "Your message has not been sent" with a
  mailto carrying everything typed. Nothing claims to have arrived that did not.
- Defences: POST only on that path, 16 KB body cap, 5 per IP per 10 minutes
  (in-memory, so per process), `Sec-Fetch-Site` same-origin, JSON only (a
  cross-site form cannot send it without a preflight), honeypot (`fax`). The
  message text is never logged.
- The design's thank-you says "We have sent a copy to …". No copy is sent (an
  auto-reply from a public form is a spam relay), so it says when and where to
  expect the reply instead.
- `?service=<slug>&plan=<id>` preselects the service and shows "You chose
  the SEO Growth plan" — only when the plan exists in `plans.ts`; unknown
  values are ignored, never echoed.
- Method cards show only with a real destination: today **Email** alone. Call
  waits for `company.phone`, "Book a call" for `bookingUrl` in
  `data/contact.ts`, LinkedIn for its profile URL. The studio's address, the
  parking/station line and "Get directions" wait for `address.street`; the
  map panel is a static image slot (an embedded map is a third-party script
  that sees every visitor's IP).
- Shared pieces: `UiField` (labelled input, `aria-invalid` + described error),
  `utils/studio.ts` (address lines, directions URL, tel link — About's card
  now uses it too), and `danger` / `danger-ink` / `danger-50` tokens (the DS's
  coral is 3.2:1, so error text uses the ink step).
- Required-field errors show after the field is left or a send is tried, and
  then follow the value live; a failed send focuses the first field to fix,
  the error box, or the thank-you heading.
- **TODO(content)**: "4 hrs average first reply" (measured how?), the reply
  promises, and the hero line "call … or come to the studio" while neither
  the phone nor the address is published.

**Insights page decisions (`Insights.dc.html`)**
- Every article names one `service` (replacing the free-text `topic`), and
  `articleTopics` maps it to the design's chip labels (Websites, SEO, Paid ads,
  Marketing, Software, UX, Branding). That label is now the topic everywhere:
  homepage category, breadcrumb, markup. "PPC" reads "Paid ads", "Strategy"
  reads "Marketing".
- Only the cost guide is written. The other twelve catalogue entries (the
  design's eight plus the homepage's four) are listed as "Coming soon" with no
  link, and the homepage list and "Keep reading" stopped linking to them too
  (they were 404s). `articleLink()` is the one place that decides.
- **Kept against the design, real or absent:** "Most read this month" became
  "Coming soon" (nothing measures readership); the newsletter section is gone
  (no mailing list, no provider, and "2,400 subscribed" is invented); the
  result line says how many are published and coming, not "newest first"
  (unwritten articles have no date); "Quick answers" does not claim the market
  ranges come from "our 2026 quote research" (the only research described is
  the cost guide's, websites only). The Apex prices there come from the plan
  catalogue and read "With Apex, from".
- Search matches every word against title, summary, topic and format, live as
  you type; without JavaScript the form is a GET to `?q=`, which the page reads.
- **TODO(content)**: the market ranges, the five new teaser titles (a writing
  plan, not a promise), and two near-duplicate Google Ads teasers.

**Gotchas**
- An `sr-only` element inside an `overflow-x-auto` box escapes it unless the
  box is `relative`; it widened the whole page by 174px at 390px.
- `nuxt-ai-ready` is disabled: its `@mdream/rust-win32-x64-msvc@2.0.3` native
  binding is not on the npm mirror yet, so a Windows build fails with it on.
- A production `nuxt build` is very slow on Windows (Nitro's externals
  resolver does millions of `stat` calls over the pnpm tree). Dev, lint and the
  prerender itself are fast; build on Linux/CI when you can.
- `.claude/launch.json` has a second config, `web`, for the preview pane.
- Vite's error overlay injects inline styles, so a transient compile error
  (e.g. between two edits) leaves "Applying inline style violates … CSP"
  errors on pages loaded meanwhile. Reload after the build settles before
  treating them as a real defect.

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

## V2 redesign (complete)

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
| 2M | Dashboard at 393px (`Dashboard - Mobile.dc.html`) | ✅ Done |
| 3M | New Order at 393px (`PHASE-3-MOBILE.md`) | ✅ Done |
| 4M | My Orders at 393px (`PHASE-4-MOBILE.md`) | ✅ Done |
| 5M | Wallet & credit at 393px (`PHASE-5-MOBILE.md`) | ✅ Done |
| 6M | Support at 393px (`PHASE-6-MOBILE.md`) | ✅ Done |
| 7M | Settings at 393px (`PHASE-7-MOBILE.md`) | ✅ Done |
| 9A | Admin — Team & platform (`PHASE-9-ADMIN.md`) | ✅ Done |
| 9B | Admin — Overview & work (`PHASE-9-ADMIN.md`) | ✅ Done |

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

Superseded 2026-10-25 by ADR-020: credit is applied for and approved by
staff, and `ensureCredit()` no longer creates or resizes lines. A new signup
has no line, which is the easy way to see the "Not set up" state.

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

**Phase 2 Mobile shipped (the dashboard at 393px).** `balance.vue` only. No
API change, no new data, no change to the Phase 2 reconciliation gate. Desktop
re-measured at 1280px and pixel-identical.

- **Active work showed no progress on a phone.** The bar was `hidden sm:flex`
  and the deadline `hidden md:inline-flex` — five items do not fit one line at
  393px — so the section whose job is progress rendered a name and a chip.
  Rows are two lines now, using `sm:contents` to dissolve the line wrappers on
  wider screens so the original one-line desktop row is reproduced exactly
  (chip returns to the end via `sm:order-last`).
- Promo: growth card stays `lg`-only, padding 20px, headline 25px, the plan's
  three real terms as wrapping chips, both CTAs stacked full width (50px/48px).
- Credit legend: two labelled rows, figures right-aligned — verified landing on
  the same pixel (x=338 at 375px).
- Service tiles → 76px rows below `md` (measured 92px with three lines of real
  copy, against the design's 76px floor); badge absolutely positioned from `md`
  so the tile is unchanged.
- Expenses: total → bar → one row per project, amount and share in fixed
  columns. Verified by **temporarily** relaxing `partsReconcile`, measuring,
  then restoring it and diffing the guard block against HEAD to prove it was
  put back.

**Deliberate deviation:** the mockup's "Payment history" header action is not
implemented. Phase 2 removed the dashboard's header action because the cash
card below already links to Wallet twice; on a phone all three would be in one
viewport. The full-width action pattern it demonstrates is live on the four
pages that do have one.

**Light-theme cost, measured:** 27 low-contrast elements of 71 before → 32 of
80 after (38% → 40%). The five additions are duplicated text reusing this
page's existing dark-only classes, so they are the same Phase 9 backlog item
rather than a new defect. Do not fix them in isolation — a second convention on
one page makes the sweep harder.

### Phase 2 Mobile gotcha — a contrast probe must handle gradients and oklab

Two traps, both of which produced confident, wrong numbers here. (1) Tailwind
emits `oklab()` for themed colours; parsing it as if it were `rgb()` turns a
near-white background into near-black and every ratio is nonsense. Convert
properly, or normalise through a canvas — and note Chrome's canvas `fillStyle`
does **not** normalise `oklab`. (2) A gradient set through the `background`
shorthand lands in `background-image`, leaving `background-color` transparent,
so walking up the tree for a background colour sails straight past the promo's
dark panel to the white page and reports white-on-white. The dashboard's navy
islands are all gradients.

**Phase 3 Mobile shipped (New Order at 393px).** `services.vue`, plus
`ApexOrderSummary.vue`, `useApexTaskBar.ts`, an `ink` surface on
`ApexBottomSheet`, task mode in `DemoToolbar`, `.apex-bleed` in `main.css`. No
endpoint, no payload, no pricing change. Desktop re-measured at 1280px and
**pixel-identical**, including every internal of the plan card I restructured.

- **Below `lg` the wizard is a task, not a page.** Hamburger to close button
  (which asks the page, since only it knows if there is an order to lose),
  search and notifications out of the bar, Secured chip in, page header hidden
  with an `sr-only` h1 keeping the heading order intact. The task-route list is
  shared with `ApexBottomNav` so the two halves of the shell cannot disagree.
- **The exit guard tells the truth.** The mockup promises a 30-day draft; there
  is no draft store, so it says the choices are cleared.
- Stepper → step name + counter + five tappable segments; `role="group"`, not
  the spec's `progressbar` (a value announcement fighting five buttons).
- Service tiles → 72px rows below `sm`; plan cards → header row below `md`; both
  via `contents`/`block` wrappers, so desktop is reproduced, not restated.
- Selects → one bottom sheet with 52px options; inputs 16px (iOS zoom) = 48px.
- Rail → 52px footer strip + summary sheet, both reading `ApexOrderSummary`.
- Success → full screen, actions pinned to the bottom, "Back to dashboard"
  replacing "New order".
- Fixed in passing: `sigPos()` scaled both axes by the width ratio (see gotcha),
  the terms link was `href="#"`, and the disabled sign button never said why.

### Phase 3 Mobile gotcha — removing a card can remove the theme with it

`bg-muted-800` on the step sections was the only thing putting this page's ~200
`text-white` classes on a dark surface. The mockup removes those cards at 393px,
and doing that alone rendered the whole wizard **white-on-white** in light mode,
because the shell's page is `#f7f8f9`. The ink had to move to the page wrapper
(`bg-muted-950`, full-bleed, `lg:bg-transparent`) — invisible in dark mode
because it *is* the page colour, and load-bearing in light. Before assuming a
dark-only page is "already broken in light and cannot get worse", measure it:
worst ratio here went 1.06 → 2.23, and 1.06 would have been my doing.

### Phase 3 Mobile gotcha — `BaseButton` sets its own `display`

`class="hidden lg:inline-flex"` on a `BaseButton` does nothing: the component's
own `inline-flex` is declared later in the same layer and wins, so the desktop
sign button stayed visible on the phone beside the footer's copy of it. Put the
visibility on a wrapper element, or use `!`.

### Phase 3 Mobile gotcha — `text-sm` carries a line-height, arbitrary sizes do not

Swapping `text-[14.5px]` for `text-sm lg:text-[14.5px]` looks breakpoint-safe and
is not: `text-sm` sets font-size **and** line-height, and the arbitrary `lg:`
size only overrides the former, so desktop silently lost ~2px of leading on
every sub-line. Caught by diffing geometry against HEAD. Use an arbitrary mobile
size (`text-[14px]`) when the `lg:` value is arbitrary too.

**Phase 4 Mobile shipped (My Orders at 393px).** `orders.vue`, plus
`useApexSubView.ts` and a sub-view mode in `DemoToolbar`. No endpoint, no
payload, no change to `payState()` or any other Phase 4 data-truth rule.
Desktop re-measured at 1280px against HEAD element by element; the only
differences are the three below, all chosen.

- **The open project is `?project=<id>` now, not a ref.** The bar has to know
  it is inside a record, and a page cannot tell it without a frame of wrong
  chrome first (the toolbar renders before the page). The URL is the one place
  both halves of the shell read the same answer at the same time — and it makes
  the browser back button return to the list. Opening pushes, the bar's back
  arrow replaces, so back never goes *forward* into the detail.
- Bar: hamburger → back arrow, section title → project name, below `lg`.
- Stats → one card of three labelled rows; filters → two lines of 38px pills
  ("Done" below `sm`); sort → 44px trigger + sheet; in-page search removed in
  favour of the shell's, whose results now land on the project.
- Card → one `<button>` with a phone body and the desktop body, because the
  chip, chevron and short id all move between rows; detail sections reorder via
  `display: contents` on both column wrappers; ring → labelled bar; real
  "no projects yet" state that hides the stats and filters instead of zeroing
  them.
- Kept against the mockup: the ⋯ options menu is not shipped (rename has no
  customer endpoint, "download brief" has no document, "contact team"
  duplicates the row below — the search button keeps the slot), the payment
  "Pay" button stays, and the summary keeps the PM chip.

### Phase 4 Mobile gotcha — `order` still applies at `lg`

The sections are sequenced for the phone with `order-*` on grid items exposed
by `display: contents`. The desktop rail is `lg:flex lg:flex-col` — also a flex
container — so those same classes reordered the rail and put the payment card
above the project summary at 1280px. Nothing on screen said so; it showed up as
a y-coordinate diff against HEAD. Every ordered element now carries
`lg:order-none`. `order` on a child of a `lg:block` container is safe, which is
why the header/milestones pair needed no fix.

### Phase 4 Mobile note — the three intended desktop changes

Header sub-line copy, the third stat tile's icon tint (violet → green, as
drawn), and `useSegments` 16 → 24 so a 24-month plan draws segments instead of
a bar. Only the last is visible: it makes everything below it in the rail sit
1px higher (a 7px segment row against an 8px bar). One fact, one encoding.

Light theme measured identical to HEAD at 393px: 4 low-contrast elements of 157
vs 4 of 156, the same four filter count badges at the same ratios — pre-existing
Phase 9 work, not a new defect.

**Phase 5 Mobile shipped (Wallet & credit at 393px).** `wallet.vue`, one line
in `useApexSubView`, and a container change to `WalletTopUp`. No endpoint, no
payload; the Phase 5 data-truth fixes (credit zero-state, `TX_LABEL`,
Receipts-not-invoices) are untouched. Desktop re-measured at 1280px across all
four tabs.

- Tabs → one four-up 40px segmented control, `Activity`/`Plans` shortened so
  four labels fit 361px instead of scrolling sideways.
- A plan gets its own screen below `lg` (`?plan=<id>`, back arrow in the bar,
  registered in the same `useApexSubView` list as a project). The desktop
  accordion is untouched and expands whichever plan the query names.
- Balance figures 38px, cards stacked, auto-pay switch 48 × 28.
- Paying an installment goes through a confirm sheet that shows the balance
  after — and warns in amber when it would go negative, which is the charge the
  server refuses.
- Top-up is a bottom sheet below `sm` with 56px presets in a 2 × 2 grid and a
  22px custom field (under 16px, iOS zooms the page in).
- The five transaction filters gained `aria-pressed`, which they had never had,
  and wrap onto two lines as 38px pills.
- Banking stacks methods → transfer → receipts → billing via `display: contents`
  on both column wrappers; a method row becomes a small card because five
  controls do not fit one line.

**Deviations, all documented in DESIGN_SYSTEM.md:** the in-page transaction
search stays (the shell's search does not index ledger rows), the plan detail
says `24-month plan` without the mockup's `· 0%` (false for a 24-month plan
under ADR-011), the credit card keeps its config-driven term copy (that *is*
the Phase 5 §6 fix), and receipts still have no download because there is still
no endpoint.

### Phase 5 Mobile gotcha — an unconditional `leading-*` beats a breakpointed `text-*`

`text-[12.5px] leading-[1.4] sm:text-xs` hands the *size* back at `sm` but not
the line-height: `leading-[1.4]` has no variant and still wins, which made the
auto-pay row 1px taller than HEAD. Scope it (`max-sm:leading-[1.4]`). Same
family as the Phase 3 Mobile `text-sm` note, from the other direction.

### Phase 5 Mobile gotcha — `sm:h-auto!` does not restore a component's height

`h-12! sm:h-auto!` on a `BaseButton` computes the *content* height (38px), not
the component's own 40px, so four desktop buttons quietly shrank. `max-sm:h-12!`
keeps the override out of the breakpoint entirely.

### Phase 5 Mobile note — measured deltas

Desktop: the only differences left against HEAD are the shorter header
sub-line, a 1px shorter Receipts section (sub-pixel rounding from the extra
list wrapper the mobile card treatment needs), and computed `min-height`
values changing from `auto` to `0px` where a mobile floor is scoped off — no
rendered geometry moves. Light theme at 393px measured **better**: 186
low-contrast elements of 450 across the four tabs at HEAD → 114 of 360, because
the Plans accordion's 24-row schedule is no longer rendered there. Overview
alone rose 28 → 34, all of it `text-muted-500` on `bg-muted-800` and
`!text-white` on `BaseButton` — the page's documented dark-only problem, which
is Phase 9's, not a new kind of defect.

**Phase 6 Mobile shipped (Support at 393px).** `support.vue`, one line in
`useApexSubView`, a second rule in `useApexTaskBar` and the two lines in
`ApexBottomNav` that read it. No endpoint, no payload; all four Phase 6
data-truth fixes are untouched. Desktop re-measured at 1280px across the three
sections — the only diffs are the two intended copy changes below and the
now-familiar `min-height: auto → 0px` where a mobile floor is scoped off.

- **Every screen is in the URL now.** The section was a ref and the open
  request was another, so the shell could not tell where the customer was —
  and the bar and the tab bar both render before this page's `setup()`.
  `?ticket=<id>` was already the panel-search deep link; `?tab=new|faq` joins
  it. Browser back walks out of a request and back through the sections.
- The desktop split pane still auto-selects the first request, but that stays a
  plain ref and never writes to the address bar — on a phone "open" has to mean
  the customer opened it, which is also what keeps the read rule honest.
- Header `New request` is `sm`+ only (the tab is the entry point); tabs become a
  three-up 40px segmented control with short labels; the team-online pill
  becomes a full-width row.
- The composer takes the bottom edge from the tab bar via a new
  `ownsBottomEdge` rule — narrower than task mode, because the thread still
  wants the sub-view back arrow and search, not a close button.
- New-request submit sticks rather than moving in the DOM (`sticky bottom-0` +
  `flex-col-reverse`), so the desktop row is provably unchanged.
- Unread gained the word "New reply", a violet border and the state in the
  card's `aria-label`; verified with a real staff reply through the admin
  endpoint, including that it clears on open and stays cleared.
- Staff avatar hidden (not removed) on continuation replies below `lg`, so the
  30px column the mockup draws as a spacer is exactly what desktop keeps.
- Category filter and related project become sheets below `lg`; status filters
  gained `aria-pressed` and wrap as 38px pills; FAQ tag sits above the question
  via `sm:contents`; every input is 16px.
- Enter stops sending on a touch keyboard — it was the only way to start a new
  line there, so multi-line replies were impossible to write on a phone.

**Two intended desktop changes:** the still-stuck card now quotes the config ETA
(§9 asks for it), and the reply placeholder drops its Enter-to-send hint (a
placeholder cannot be responsive, and the hint is no longer true on touch).

**Deviations:** no ⋯ options menu (rename has no endpoint, no brief exists,
"contact team" is this screen) — the search button keeps the slot, as in Phase 4
Mobile; the H1 stays "Support center"; the page sub-line stays; the empty inbox
keeps the mockup's dashed card below `lg` and the existing sentence in the
desktop pane.

### Phase 6 Mobile gotcha — `overflow-y: auto` breaks `position: sticky`

An element with `overflow-y: auto` is a scrollport even when its content never
overflows, so a `sticky bottom-0` child is pinned to a box that does not move —
the footer simply sat in the flow. The new-request section is
`max-lg:overflow-visible` for exactly this reason; it keeps the desktop
`overflow-y-auto` that the bounded page height needs.

### Phase 6 Mobile gotcha — relative-colour output is 0–1, not 0–255

`rgb(from <col> r g b / alpha)` is the reliable way to get oklab/lab into sRGB,
but Chrome answers with `color(srgb r g b / a)` whose channels are floats.
Parsing them as 0–255 made every colour near-black and every contrast ratio
exactly 1.00 — a whole page of confident false failures. Third trap in this
probe family, after oklab parsing and gradient backgrounds.

### Phase 6 Mobile note — one real light-theme regression, found and fixed

Making the team-online pill visible at 393px put `text-white` on a 10% green
tint over a near-white page: **1.17**. Now `text-muted-900 dark:text-white`.
With that fixed the page measures 12 low-contrast elements of 36 against HEAD's
11 of 34 — same proportion, and all of them the `text-muted-500`-on-`bg-muted-800`
debt Phase 9 owns.

**Phase 7 Mobile shipped (Settings at 393px).** `settings.vue`, a sub-view
registration, a bottom-edge rule, a title resolver in `useApexSubView`, and two
**additive** fixes in `update-all.put.ts`. Every Phase 7 data-truth rule is
untouched. Desktop re-measured at 1280px across all four sections; the only
diffs are the copy changes listed below.

- **Hub → section drill-down below `lg`.** Account row, four 72px section rows,
  notifications, legal, sign out; each section is its own screen with the back
  arrow in the bar and a save footer on the bottom edge. `?section=` carries it
  — same reason as Orders/Wallet/Support. No query = the desktop panel shows
  Profile, exactly as before.
- **The footer posts only its own section**, verified by intercepting the PUT:
  Company sends `{company:{…}}`, Profile sends `{user:{…}}`. Two additive
  server fixes made that safe: `company` is now `.optional()` (omitting it means
  "don't touch the company record" rather than running an upsert), and the
  update branch uses `name: company.name ?? undefined` instead of
  `company.name || ''`, which used to blank the registered company name on any
  payload that left it out. Checked by saving Profile alone and reading the
  company row back intact.
- **The mockup's new fields are absent, deliberately.** Trading name, company
  number, six-field UK address with postcode validation, separate billing
  email, a second billing address behind a "same as office" switch, three
  notification switches and a photo action sheet all need columns or endpoints
  that do not exist. What ships: the single free-text address (heading still
  switches to "Business address" for sole traders), the billing summary derived
  from the company record, a notifications card stating what we send, and the
  standing photo-upload statement.
- Business type is a 52px wrapping trigger over a 56px-row sheet; every input is
  52px at 16px; password keeps its own button and fires **zero** requests on all
  three invalid cases; mismatch shows on the confirm field as you type; 44px
  show/hide eye on the current password; 6px strength meter.

**Two intended desktop copy changes:** company email/phone marked `(optional)`,
and the notes field takes the mockup's label plus a line saying who sees it. The
show/hide eye renders at both sizes (Phase 8's standard for password inputs).

**Deviations:** the tab bar stays on Security (the mockup gates it on "hub
only", but its reason is the save footer, and Security has none — so
`ownsBottomEdge` already answers it); no `v2.4.0` version line (nothing real to
read); no "Needed" chip on Billing (VAT is optional and the page says so).

### Phase 7 Mobile gotcha — a route-derived bar title mismatches on hydration

Publishing the section name through `useApexSubView`'s shared `title` looked
exactly like what My Orders and Support do, and it mismatched on every deep
link: the toolbar renders *before* the page on the server, so the server emitted
"Settings" while the SSR payload already carried "Company". The other pages are
safe only because their names come from a lazily fetched record, so the payload
is null on both renders. A name that is a pure function of the query has to be
resolved *in the composable* — `SUB_VIEWS[].label` — and `barTitle` prefers that
over anything a page publishes.

### Phase 7 Mobile gotcha — dissolving the cards took the theme with it

`bg-muted-800` on the section cards was the only thing putting this page's
`text-white` labels on a dark surface. The design removes those cards at 393px;
doing that alone measured **1.06** on six labels in light mode — white on
near-white, and mine, not the backlog's. The section-screen wrapper carries the
ink instead (invisible in dark mode because it *is* the page colour), the same
fix the New Order wizard needed. After it: 9 low-contrast elements of 22, all
`text-muted-500`, at 2.33 against HEAD's 1.98 for the same elements.

**Phase 9 Admin shipped (Team & platform).** The first of the four admin
mockups. Three screens — `/admin/team` (new), `/admin/settings` (rebuilt),
`/admin/audit` (lifted out of Tools) — plus a shell regrouping and a real
six-role permission model. **This phase adds schema and server code**, all
additive; see ADR-016.

- **One matrix, both halves of the app.** `shared/permissions.ts` holds six
  staff roles × eleven permissions. `requireStaffPermission()` throws the 403
  from it and `/admin/team` renders the table from it, so documentation and
  enforcement are literally the same array (badge 26). All 38 pre-existing
  `/api/admin/**` routes moved off `requireAdmin` onto it — behaviour-identical,
  because every existing admin backfills to `owner` and the fallback is `owner`
  too. Verified after: 11 admin pages + 15 admin APIs still 200 for an owner,
  six customer pages untouched.
- **Additive schema:** `User.staffRole`, `User.staffJoinedAt`, `StaffInvite`,
  and `AuditLog.roleAtTime` / `.reason`. No column changed type, nothing dropped.
  **`prisma db push` + a backfill (`role: ADMIN` → `staffRole: 'owner'`) is
  required on deploy**, or every admin silently falls back to owner — which is
  safe, but not what the panel will say.
- **Suspension now ends a live session.** `requireRole` checked the role fresh
  but never the status, and sessions are 7-day JWTs, so "Suspend" blocked the
  next sign-in while the person kept working. Verified with two cookie jars:
  200 → 403 on the same cookie, 403 → 200 on restore.
- **The invite loop is closed.** `/auth/accept-invite` ships on the Phase 8 auth
  shell. Role and email come from the invite row, never the body; the token is
  claimed by a conditional update inside the account-creating transaction
  (replay verified → 400). Nothing is emailed — no mail provider — so the panel
  hands over the link and says so.
- **Badge 27 verified end to end:** setting the Normal reply target to 25 in the
  admin made `/api/config` serve "~25 min" to the customer Support page, through
  the one `shared/support-eta.ts` formatter both call.
- **Audit log:** absolute timestamps with timezone, actor + role-held-at-the-time
  (pre-Phase-9 rows show "—" rather than a back-filled lie), typed reason, kind
  chips, CSV export of the whole filtered set (47 rows, UTF-8 BOM verified in the
  bytes). No edit or delete affordance, and no endpoint behind one.

### Phase 9 Admin gotcha — `BaseSelect` does not forward `id`

`<BaseSelect :id="x">` puts nothing on the trigger, so a sibling
`<label for="x">` points at an element that does not exist. Six shipped that way
before the sweep caught them; a dangling label is worse than none (same family as
Phase 1 Mobile's dangling `aria-describedby`). Name the select with `aria-label`
and make the visible text a `<span>`. Separately: reka renders a 1px
`aria-hidden` `tabindex="-1"` native `<select>` for form compatibility when the
component is inside a `<form>` — do not count that as a native select.

### Phase 9 Admin gotcha — a prefix filter needs exclusions AND a catch-all

Classifying audit rows by action prefix broke twice. `admin.team.` is Team but
`admin.team.suspend` is Access, so every more-specific prefix owned by another
bucket has to be excluded or a row shows under two filters. And the display's
"unknown action → Config" fallback has to be mirrored in the query, or a row
renders a Config chip while being invisible under every filter — visible in
"All", unfindable by clicking the kind it claims to be. Four rows were in that
state until measured. Fix: one `kindFilter()` the query and the chip share, then
assert the buckets *partition* the log (45 rows, 5 filters, 0 double-counted).

### Phase 9 Admin — deliberate deviations

No 3/6/36-month instalment terms (ADR-011 prices only 12 and 24); no
"hold deliverables until fully paid" switch (no deliverables feature — it would
be Phase 7's `twoFactor`); "Last active" is **Last action**, derived from the
audit trail, because nothing records a sign-in; the audit log's **Files** filter
is **Work**, because deliverable release writes no entry and a filter that always
returns zero is a dead control; sign-in limits state the code's real numbers
(5/minute, 15-minute block) not the mockup's; and Settings keeps every control
the old page had, with the non-client-facing ones below the four design panels.

### Phase 9 Admin — light theme

These four screens were written with light/dark pairs from the start. Measured at
1440px in light mode: **1** low-contrast element on each of team (258 checked),
settings (228), audit (311) and tools (82) — the same one every time, the shared
toolbar's decorative `/` separator, which measures identically on the untouched
`/admin/users`. They add nothing to the Phase 9 light backlog.

### Phase 9 Admin — dev test data

`admin@apex.com` is `owner`. Five more staff seeded locally at
`{priya,sara,tom,hannah,alex}@apexdigi.co.uk` / `staff12345`, one per role, plus
`leah@apexdigi.co.uk` created by actually accepting an invite. Local only —
`prisma/dev.db` is never committed.

**Phase 9B shipped (Admin — Overview & work).** The second of the four
admin mockups. Three screens — `/admin` (rebuilt as a work queue),
`/admin/projects` (rebuilt as the design's Orders table) and
`/admin/projects/[id]` (the management screen plus the release gate) —
plus the feature the file is named for. **This phase adds schema and
server code**, all additive; see ADR-017.

- **Deliverables can now be withheld and released.** `DeliverableRelease`
  + `deliverables.hold-until-paid` + one shared `utils/deliverables.ts`
  that the admin panel *and* `/api/orders` both read. Verified end to end:
  with holding on, the customer's own project page returns file names and
  sizes with **blanked URLs** and renders them as plain rows rather than
  dead links; releasing hands the URLs over; withdrawing takes them back.
  Release requires a typed reason while a balance is outstanding (400
  without one), is idempotent (409 on a double release/withdraw), and
  writes an audit row carrying the reason and the role held at the time.
- **The audit log's Files bucket is real now**, closing the deviation the
  Team & Platform phase documented. Re-verified the partition after adding
  a sixth bucket: 54 rows = 15 access + 5 team + 7 money + 2 files + 12
  work + 13 config, **0** double-counted, **0** orphaned, and **0**
  chip/filter mismatches across every row.
- **Money is omitted, not blanked, for roles without `money.view`.**
  Verified across five roles: PM / Support / Read-only get no `money`
  object and a `null` contract value; Finance gets both; release is 403
  for Finance, Support and Read-only, naming "Owner, Admin or Project
  manager", and 200 for a PM.
- **Bulk assign** from the Orders table PATCHes through the endpoint that
  already audits the change — no second, unaudited path. The picker lists
  exactly the staff whose role holds `work.assign` (verified: Owner,
  Admin and both PMs; no Support, Finance or Read-only).
- **Stage is the milestone timeline**, and advancing it recomputes
  `progress` in the same transaction. Verified in the browser: 65% → 60%
  (3 of 5) with the button moving to the next stage and the audit entry
  appearing at the top of Activity.

**Two real bugs found and fixed while building, both pre-existing:**

### Phase 9B gotcha — SQLite sorts NULL first, so milestones rendered backwards

`orderBy: { date: 'asc' }` on milestones: only *completed* ones carry a
date, so the finished stages sorted to the **end**. The timeline read
"Frontend Development, Backend Integration, Testing & QA, Project
Scoping, Wireframing & UI" — on the **customer's** My Orders page as well
as the admin panel — and it silently corrupted the progress figure my new
`advance` endpoint derives from the order. `{ sort: 'asc', nulls: 'last' }`
is supported on SQLite; applied at all four sites. Verified both timelines
now read in order.

### Phase 9B gotcha — `<BaseSelectItem value="">` throws at hydration

reka reserves the empty string for "no selection": *A `<SelectItem />`
must have a value prop that is not an empty string.* The Orders service
filter shipped with `value=""` for "All services". The SSR HTML rendered
a perfectly good table and the page then **replaced itself with a 500
screen on hydration** — a DOM probe immediately after navigation saw 12
rows, and the same probe a moment later saw an error page. Use the
`placeholder` prop; clearing then means setting the model back to `''`,
so the filter got its own visible reset row. Phase 7 documented the
blank-trigger half of this; this is the same trap throwing rather than
rendering wrong.

### Phase 9B note — no amber the design system defines is legible on white

Measured: `#F2C14E` 1.68:1 on white, `--apex-warning` `#D9A521` 2.24,
`#EC6453` 3.22, and amber on its own tint 1.99. The light spec's answer
is a tinted chip rather than coloured text, in a shared `utils/status.ts`
that does not exist yet — so bare accent *text* pairs to the ink token in
light and keeps the accent in dark, and chips/icons are left alone rather
than given a convention the rest of the panel does not share. Light theme
measured at 1440px: Overview **1** of 100, detail **10** of 127, Orders
**14** of 138, against untouched `/admin/users` at **52 of 113**.

### Phase 9B — dev test data

`deliverables.hold-until-paid` is **ON** in the local DB and project
`5afb0805` (E-Commerce Redesign) was set to COMPLETED with four seeded
`ProjectFile` rows and an outstanding plan, so the held/release flow is
visible without setup. Turn the setting off in Platform settings to see
the other states. Local only — `prisma/dev.db` is never committed.

### Phase 9B — deploy note

`prisma db push` is required (two new tables: `DeliverableRelease`,
`ProjectNote`). No backfill needed — with the hold setting absent it
defaults to **off**, which is exactly the behaviour production has today.

## Production deploy — 2026-10-20 (panel: Phases 8 → 9B; website: first deploy)

- **Panel** shipped with `scripts/ship-bundle.sh` (health check 200, Stripe
  live keys intact). Before it, the Phase 9A/9B schema was applied to the live
  SQLite DB as the exact additive SQL `prisma migrate diff` printed (4 nullable
  columns, `StaffInvite`, `DeliverableRelease`, `ProjectNote` + indexes), plus
  the backfill `staffRole = 'owner'` for the 3 ADMIN accounts. Backup:
  `/opt/apex/backups/dev.db.20261019-231726.pre-phase9`; the server's
  `prisma/schema.prisma` now matches the repo (old copy beside it,
  `.pre-phase9`). The deliverables hold setting is absent, i.e. off.
- **Website** is a second service on the same box — see the Public website
  section. `apexdigi.co.uk` is suspended at the registry (expired
  2026-08-06), so until renewal the two apps answer only at
  `https://146-19-130-11.sslip.io` (panel) and
  `https://site.146-19-130-11.sslip.io` (site).
- The deploy surfaced ~20 links from service pages and the homepage to case
  studies that are not in the catalogue; those cards now render without a
  link until their study exists. Remaining dead links are only pages not built
  yet (Insights index, Careers, unwritten articles, the six legal pages).
- The panel checkout on this machine had no `node_modules` (moved to D:);
  `pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com/`
  took 12 minutes and changed no lockfile.

## Backend and API audit — 2026-10-23

Every route in the panel was called as a customer and as an owner, with the
bodies the pages actually send, and every page's SSR payload was inspected.
The website's one route (`/api/contact`) was re-checked. Found and fixed:

- **`POST /api/finance/deposit` was a free-money endpoint, live in production.**
  Any signed-in customer could add up to £1,000,000 to their own wallet with no
  payment, then spend it on instalments or `/api/orders/pay`. The UI had moved
  to `/api/finance/topup` (ADR-015) but the route was never removed. Deleted.
- **`/api/orders` priced orders from the request body.** A hand-written request
  could sign a £4,800 plan at £1, or at £0 (which also skipped the credit
  check). It now takes `serviceId` + `planId` and prices from `catalog.services`;
  the shown `budget` must match or it is a 409 with the current price. The
  stored agreement also named the project title as the plan; it now names the
  catalogue plan, which is what the contract step shows.
- **Wallet showed the wrong balance.** `balanceOverview.cash` was the sum of the
  ten newest transactions; it is now `User.walletBalance`, the figure every
  charge is checked against. The hardcoded `monthlyChange: 12.5` is gone.
- **`/api/finance/credit/repay` kept money for nothing** — `ensureCredit()`
  recomputes `used` on every load, so the decrement vanished. `credit/apply`
  was undone the same way. Both deleted.
- **`/api/settings/profile` changed the login email with no verification.**
  Unused by any page; deleted. `update-all` stopped accepting the CRM fields
  Phase 7 took off the page (company status, manager, income, employees) and
  the avatar/cover/logo URLs.
- Audit rows for phone-only customers were silently dropped (`actorEmail` is
  required). `recordAudit` falls back to the actor id; orders pass the phone.
- Support's reply, new request and thread load had `try/finally` with no
  `catch` — a failed send said nothing. Each now toasts what did not happen.
- Signing in forgot where the visitor was going, so the website's "Start your
  order" link ended on the dashboard. Guards now pass `?redirect=` (same-site
  paths only — `utils/authRedirect.ts`), and sign-in/sign-up honour it.
- Every panel page carried Tairo's whole docs search index (~220 KB) because
  `DemoAppSearch` awaited it in `app.vue`; in production the same query failed
  and logged an unhandled `__nuxt_content` error. It now loads on first open.
  Pages went from ~330 KB to 76–103 KB.
- `/api/config` was fetched twice per page (layout + page each had their own
  key) — `useApexConfig()` shares one. Signed-out visitors to the legal pages
  got a 401; they now get the site name and support email.
- Also: notification mark-read rolls back on failure, phone-only customers show
  their phone in admin user cells, GoCardless omits a null email, the Tairo
  demo routes `/api/payments/*` and `/api/hello` are gone, and the website's
  Resend retry carries an idempotency key so a timeout cannot send twice.

**Deployed 2026-10-23** (`1340b4b`): panel via `ship-bundle.sh` (local build
~25 min on Windows, health 200, Stripe keys intact, no schema change), site via
`ship-web.sh`. Verified live: the six removed routes 404 (deposit answered 401
before, i.e. open to any account), guarded pages redirect with `?redirect=`,
`/api/config` serves the public pair when signed out, a bad login is 401, and
the panel journal shows no `__nuxt_content` errors after page loads.

**Local dev gotcha.** The D: checkout's committed `prisma/dev.db` predates the
Phase 9 schema, so every login 500'd (`User.status` missing) until
`pnpm exec prisma db push`. That modifies `dev.db` locally — never commit it.

**Dev-only noise.** After signing in, the console can show `Cannot read
properties of null (reading 'flags')` from Vue's HMR `reload()`. It is the hot
reload runtime, absent from production builds.

## Repo cleanup — 2026-10-15

Removed code nothing reachable from the Apex product referenced, found by a
reachability walk from the customer/admin/auth/legal pages (components by tag,
composables by identifier, APIs by `/api/` string, images by path), then
verified by an identical 42-check route/API smoke run before and after.
Gone: the Tairo demo pages (`layouts/**`, `starters/**`, `wizard`, `demos`, the
template dashboards, the landing page), 5 unused layouts, ~160 components,
calendar/diceware/format utils, the template API routes, ~916 template images
(144 MB → 5 MB of `public/img`), plus junk (a committed curl cookie jar, the
Docker installer, a MySQL migration for a SQLite schema, 1,265 tracked Node
compile-cache files). **Deliberately kept:** the vendor docs subsystem
(`content/`, `examples/`, `pages/documentation`, `@nuxt/content`,
`tairo-component-meta`), `.app/`, `layers/tairo`, `AgencyCalculator.vue` and
`layouts/default.vue` — removing those means editing module config and
dependencies and needs a production build to prove safe.

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

- **ESLint crashes on some files**: `eslint-plugin-unicorn@60` + `eslint@9.24`
  → `TypeError: context.sourceCode.isGlobalReference is not a function` from
  `unicorn/error-message`, on any file with a bare `throw new Error()`
  (`server/utils/crypto.ts`, `app/components/AddonInputPhone.vue`, …). It aborts
  the whole run, so `pnpm lint` over a broad path fails. Pre-existing and
  unrelated to page work — lint an explicit file list instead. Fixing it means
  bumping eslint or pinning the plugin.
- `pnpm test:tsc-demo` now runs (it used to die on an npx/vue-tsc env issue) and
  reports **87 pre-existing errors**, 36 of them in `layers/tairo`. Check a
  change against that baseline rather than expecting zero.
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
