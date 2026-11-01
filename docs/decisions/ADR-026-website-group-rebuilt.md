# ADR-026 — The console's Website group, rebuilt from the design

**Status:** Accepted (2026-11-01), in progress on `feature/admin-website`.
Supersedes the CMS half of ADR-024 and the "no Website group" part of
ADR-025. Builds on the content tables ADR-021 left in the schema.

## Context

The admin console went live on 2026-11-01 without the design's Website
group (ADR-025). The owner then asked for those screens to be built:
Pages, Insights, Case studies, Media library, Navigation & footer, SEO &
redirects, Enquiries, Analytics, and Site settings under System. Their
choices, asked before any code:

- **Rebuild from `Admin Console.dc.html`**, rather than restoring the
  28–31 October CMS from git. The content tables that build created
  (`SiteDocument`, `SiteRevision`, `SiteRedirect`, `SiteMedia`,
  `SiteMediaRef`) are still in the schema and in production, so they are
  reused ("reuse existing models").
- **The design's permission matrix** for the Website group.
- **Enquiries are stored**: the site's contact form also sends each message
  to the panel; messages that did not become a client are deleted after
  **24 months** (UK GDPR storage limitation).
- **Analytics from our own cookieless counts**: the site's server records
  page views, referrers and enquiry conversions itself, with no cookies, no
  third-party script and no IP address stored.

## Decisions

### Permissions (`shared/permissions.ts`)

| Design key | Ours | Roles |
|---|---|---|
| `site.see` | `website.view` | Owner, Admin, Project manager, Support, Finance, Read-only |
| `site.edit` | `website.edit` | Owner, Admin, Project manager, Support |
| `site.publish` | `website.publish` | Owner, Admin |
| `media` | `website.media` | Owner, Admin, Project manager, Support |
| `site.structure` | `website.seo` (relabelled "Navigation, SEO and redirects") | Owner, Admin |
| `leads` | `leads.handle` (new) | Owner, Admin, Project manager, Support |
| `analytics` | `analytics.view` (new) | Owner, Admin, Project manager, Finance, Read-only |
| `site.settings` | `website.settings` | Owner (Admin no longer) |

Publisher and Editor keep the website permissions they had, so an account
holding one still works; the design does not use them. The design's other
differences from our matrix (`contract.sign`, `credit.review`, an `audit`
permission for Finance) are outside this workstream and unchanged.

### Real or absent

The design is a prototype; where it draws something the platform cannot
stand behind, the screen states what is true instead:

- **The editor's sections.** The design builds every page from ten
  section types. New pages, articles and case studies are built that way
  and the site renders them. The site's existing pages are hand-built
  components: in the editor they show as their real sections with editable
  words, and cannot gain, lose or reorder sections. The editor says so.
- **Preview** is the site's own rendering of the draft, not a mock-up.
- **Price blocks and service tiles** read the site's own plan catalogue.
- **Site settings** has no analytics provider choice and no cookie
  switches: the analytics sets no cookie, so there is nothing to ask
  consent for. The screen says that.
- **The price block** is not offered: it belongs to service pages, which
  are hand-built, so no built document could use it.
- **Buttons carry a destination.** The design draws a button label only;
  every section button has a "goes to" field beside it, and a button with
  no destination is not rendered.

## Content and the site reading it (phase B, 2026-11-01)

- **One contract, both apps.** `web/shared/cms` gained `sections.ts` (the
  section types), `documents.ts` (coded vs built documents, the four
  collections, address rules, the status chip) and `resolve.ts` (the
  field-by-field overlay). The panel imports it through
  `.demo/shared/cms.ts`, by relative path, as ADR-021 did.
- **Workflow on the existing tables.** `SiteDocument.draft` is the working
  copy and saving it never touches the site; publishing writes a
  `SiteRevision` and moves `publishedRevisionId`; `review = IN_REVIEW`
  locks the draft for anyone who cannot publish; "Published · draft
  changes" is a draft that differs from the live revision. A save carries
  the draft version it started from (409 over a newer save), and so does a
  publish (409 rather than putting unseen words live). The "changes
  requested" note is read from the audit log, which already holds it.
  Endpoints: `/api/admin/website/{documents,documents/:id,…/draft,…/submit,
  …/withdraw,…/request-changes,…/publish,…/restore,…/preview,import,history}`;
  public, read-only: `/api/site/{page,globals,manifest,preview/:token}`.
- **Import.** `POST /api/admin/website/import` reads the site's baseline
  (`/api/cms/baseline`) and makes each coded page a published document at
  revision 1 with exactly the words already live, so importing changes
  nothing a visitor sees. Running it again only adds what is new.
- **Legacy documents retired.** The tables still held the removed CMS's
  documents from October, whose words the code has since changed.
  `docs/migrations/2026-11-website-legacy.sql` archives them and moves
  their addresses aside (`~legacy-<id>`), deleting nothing; the public
  endpoints also ignore any template the contract does not know.
- **The site.** `middleware/cms.global.ts` loads the page's published
  document and the chrome before the page's setup runs (pages copy values
  out of their content during setup); `useCmsContent`/`useCmsRecord` lay
  them over the baseline. `server/utils/cms.ts` caches each answer for
  60 s with stale-while-revalidate, keeps the last good answer on disk for
  panel outages, and is purged by the panel after a publish; a cache
  generation in every key stops a background refresh that finishes after a
  purge from writing the old words back. Built documents render at
  `[...slug]` (pages), `/insights/:slug` and `/our-work/:slug` (when the
  code catalogue has no record there), section by section; `/preview/:token`
  renders a draft (built, the six fixed pages, articles and case studies;
  service pages with the editor). The sitemap adds published built pages
  and leaves out anything set to noindex.
- **Env** (both documented in `.env.example`, plus `CMS_PANEL_ORIGINS` below): panel
  `NUXT_WEBSITE_SITE_URL`, `NUXT_WEBSITE_REVALIDATE_SECRET`,
  `NUXT_WEBSITE_PUBLIC_URL`; site `NUXT_CMS_URL`,
  `NUXT_CMS_REVALIDATE_SECRET`. The repository is public and its tracked
  `.demo/.env` and `web/.env` hold a dev-only pairing (panel :3000, site
  :3001): those values must never be used in production.

## The screens and the editor (phase C, 2026-11-01)

- **Lists.** Pages and Insights are one component (`AdminWebsiteDocList`):
  the design's four status filters with counts over the whole collection,
  one row per document, and on Pages an "All pages · Publish history" tab
  read from the audit log. Case studies is the design's card grid without
  its striped cover band (a study's pictures are its image sections; a
  placeholder band would read as a missing picture). Pages carries
  "Import from site" for Owner and Admin. "New …" creates an untitled
  draft at a placeholder address and opens it, as the design does; the
  SEO tab renames and moves it.
- **Editor** (`AdminWebsiteEditor`, `/admin/website/{pages,insights,case-studies}/:id`):
  sections, the selected section's fields with Content · SEO · Revisions,
  and the preview, as drawn (252 / 372 / the rest from `xl`; stacked
  below). Built documents add, remove, hide, reorder (buttons and drag)
  sections; articles and case studies have a pinned "Listing details" row
  for their category, sector and summary. Coded pages show their
  template's parts as fixed sections with editable words. Every field is
  generated from the contract (`AdminWebsiteField`), and the server's
  errors come back by path onto the right input, with a dot on the
  section. The workflow buttons, banners and confirmations are the
  design's; leaving with unsaved changes asks first.
- **Preview** is the site's `/preview/:token` page in a frame, scaled to
  the pane (desktop 1200px, mobile 390px). It shows the draft as last
  saved, and says so when there are unsaved edits. The site allows only
  the panel's origins to frame `/preview/**` (`frame-ancestors`, fixed at
  build time: the production panel hosts, `CMS_PANEL_ORIGINS`, and
  localhost in a dev build); every other page keeps `frame-ancestors
  'none'`. The panel's CSP adds the site's origin (from
  `NUXT_WEBSITE_PUBLIC_URL`) to `frame-src`. Clicking a section inside
  the preview does not select it: the frame is another origin. Service
  pages now preview as themselves (`<ServicePage>`).
- **Moving a page.** `PATCH /api/admin/website/documents/:id/path`, for
  built documents only (a coded page's address is its code's). A draft
  nobody has seen moves freely; a page that was ever live leaves a 301
  from the old address (redirects that pointed at it are moved too, and a
  redirect from the new address is dropped), and so needs `website.seo`
  as well as `website.edit`. The site serves these redirects from phase D
  (its redirect middleware is part of SEO & redirects).
- **Sidebar counts.** Pages, Insights and Case studies show how many
  documents wait for review, for the roles that review them
  (`GET /api/admin/website/review-counts`).
- **Not built:** the design's media picker list until the Media library
  exists (an image section says it shows nothing until an image is
  chosen); scheduled publishing (not in the design).

## Media, menus, SEO and Site settings (phase D, 2026-11-02)

The server logic the October CMS had for these (byte sniffing, header
dimensions, the redirect checker, the settings registry, the site's
redirect middleware and robots hook) was restored from git and fitted to
today's contract; the screens are new, from the design.

- **Media library** (`/admin/website/media`, `website.media` to change):
  JPEG, PNG, GIF, WebP and PDF, 10 MB each, checked by their bytes (never
  SVG), stored by UUID under `NUXT_WEBSITE_MEDIA_DIR`. The design's
  filters (All · Images · Documents · Missing alt text · Unused), a detail
  panel with where the file is used, alt text, Copy link and Delete. A file
  a page uses (draft or live) or set as the default social image cannot be
  deleted. A row whose bytes are gone says "File missing". The console
  serves files at `/api/site/media/:id/:version/:name`; the site passes
  them through at `/media/…` (same origin, so the strict CSP holds) and
  image sections render a plain `<img>` with the file's size. No resizing:
  upload images at the size they are shown. Built pages use their first
  image as their social image.
- **Navigation & footer** (`/admin/website/navigation`): the header menu,
  its button and the footer's link columns, from the header and footer
  documents; "Publish menus" saves and publishes both. Links to addresses
  with no published page are marked "No page". The design's sub-items are
  absent: the site's only dropdown is Services, built from the catalogue.
  Menus are the design's `site.structure`, so the server now refuses
  chrome-document edits without `website.seo` (Owner, Admin).
- **SEO & redirects** (`/admin/website/seo`): Page SEO (title and
  description lengths of what is live, or of the draft when nothing is;
  a built page with no description counts the summary or hero intro the
  site serves instead), Redirects (live check as typed: loops refused,
  chains flattened, a live page at the old address warned about), and
  Sitemap & robots (what is listed and left out; extra Disallow paths,
  never `/`, `/_nuxt` or `/media`). The site answers redirects before
  routing (`server/middleware/00.redirects.ts`, query kept) and adds the
  paths to robots.txt (`server/plugins/robots.ts`).
- **Site settings** (`/admin/site-settings`, Owner): registered and
  trading name, company, VAT and ICO numbers, registered office, email,
  phone, social profiles, the default social image, maintenance mode.
  Each key is validated on the server; an empty one keeps the site's code
  value, so nothing is ever printed as a placeholder. The site lays them
  over `data/site.ts` (`useCompany()`, loaded with the chrome) in the
  footer, About, Contact and the Organization markup. Maintenance mode
  answers every page 503 with a holding page and the contact email
  (`error.vue`, Retry-After) and the contact form 503; the preview,
  assets and APIs keep working. Cookie switches and an analytics provider
  are stated, not switched: the site sets no optional cookie and loads no
  analytics script.
- Public, read-only: `/api/site/{settings,redirects,media/…}`; page and
  preview answers carry a `media` index for built documents.

## Enquiries (phase E, 2026-11-02)

The owner chose to store enquiries and keep them 24 months.

- **Two ways in, one message.** The site's `POST /api/contact` still
  emails the team (when `NUXT_CONTACT_*` is set) and now also forwards
  the message to the console, at `POST /api/site/enquiries`. Either one
  arriving counts as delivered; the visitor sees "not sent" only when
  neither did. The forward is signed: an HMAC-SHA256 over the timestamp
  and the raw body with a shared secret (site `NUXT_CMS_ENQUIRY_SECRET`,
  panel `NUXT_WEBSITE_ENQUIRY_SECRET`), checked in constant time within
  five minutes (`web/shared/enquiry.ts`, imported by the panel by
  relative path). Unset secret: 503. The site's id for the submission is
  unique, so its one retry stores once. What crosses is what the visitor
  typed, the labels of the options they picked and the page they sent it
  from: no IP address or other request data.
- **Model.** `Enquiry` and `EnquiryNote` (staff only, deleted with the
  enquiry), `docs/migrations/2026-11-enquiries.sql`, additive.
- **Screen** (`/admin/website/enquiries`, `leads.handle`): the design's
  list and detail. Filters Open · New · Contacted · Qualified · Won ·
  Lost with counts; status and owner (anyone holding `leads.handle`);
  staff notes; "Reply by email"; "Mark as lost" needs a reason, kept for
  reporting and never sent; moving it off Lost reopens it and clears the
  reason. The selected enquiry is in the address (`?enquiry=`). The
  sidebar row counts enquiries nobody has contacted; the Overview has the
  design's tile, queue rows and "Latest enquiries"; ⌘K searches open
  enquiries.
- **Convert to client** (`leads.handle` and `clients.approve`): a
  customer account with no usable password and a company if a business
  was given; the enquirer is emailed a set-password link valid 72 hours
  (`client-welcome` in the outbox; after that "Forgot password" works).
  With mail unconfigured the account is still made and the screen says
  the email did not go. An address that already has a client account is
  linked instead, with no email; a staff address is refused. The enquiry
  becomes Won and stays Won.
- **Retention.** `website:enquiries-retention` runs daily at 03:17 and
  deletes enquiries older than 24 months that did not become a client,
  with their notes. Audit entries name an enquiry by its reference
  (`ENQ-1A2B3C`), never the person, and the deletion is logged as a count,
  so the append-only log keeps no copy of what retention removes.
- **Real or absent.** The design's "Marketing consent" and "Privacy notice
  accepted" describe checkboxes the form does not have; the screen says
  no marketing consent was asked, so replies are about the enquiry only.
  The design copies the message and notes to the client record; the
  client's own notes are customer-editable, so they stay on the enquiry
  (staff only) and the enquiry links to the client. No notification or
  email per enquiry inside the console: the team's inbox already gets the
  site's email, and the sidebar count and Overview show what is new.
