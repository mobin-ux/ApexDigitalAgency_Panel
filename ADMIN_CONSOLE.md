# Admin console

The staff side of the Apex panel: one console at `/admin` for running client
work, support, money and the team, built from the Claude Design file
`Admin Console.dc.html` (project `eb7c3341-…`). It lives in the same Nuxt
app as the customer panel (`.demo/`) and works on the same database rows,
so a change made on one side is what the other side reads next.

Merged to master in PR #1 (`53c25d8`) and deployed to production on
2026-11-01, migrations included (see [Migrations](#migrations)). Decision record:
[ADR-025](docs/decisions/ADR-025-admin-console-reinstated.md).

**The Website group** (Pages, Insights, Case studies, Media library,
Navigation & footer, SEO & redirects, Enquiries, Analytics, and Site
settings under System) was rebuilt from the same design on
**`feature/admin-website`**, merged in PR #2 and deployed on 2026-11-02. Decision
record: [ADR-026](docs/decisions/ADR-026-website-group-rebuilt.md), which
supersedes the CMS half of [ADR-024](docs/decisions/ADR-024-remove-admin-console.md).
The public site (`web/`) reads what the console publishes; see
[The website and the console](#the-website-and-the-console).

Contents: [Architecture](#architecture) · [The website and the console](#the-website-and-the-console) ·
[Sign-in and sessions](#sign-in-and-sessions) ·
[Roles and permissions](#roles-and-permissions) · [Endpoints](#endpoints) ·
[Money guardrails](#money-guardrails) · [Audit log and data](#audit-log-and-data) ·
[Migrations](#migrations) · [Environment variables](#environment-variables) ·
[The first Super Admin](#the-first-super-admin) · [Tests](#tests) ·
[Not built](#not-built)

---

## Architecture

```
.demo/
  app/pages/admin/            the screens (29 page files, listed below)
  app/pages/admin/sign-in.vue the staff sign-in (password, then authenticator code)
  app/layouts/admin.vue       the shell: 236px sidebar (drawer below lg), 64px top bar,
                              breadcrumb, ⌘K palette, theme switch, access wall
  app/utils/adminNav.ts       the sidebar table: every row names the permission it needs
  app/middleware/admin.ts     route guard: no staff session → /admin/sign-in
  app/components/Admin*.vue   the console's building blocks (page, header, card,
                              button, status chip, dialog, drawer, confirm host,
                              command palette, sort header, access wall)
  app/composables/            useStaffAccess (role → can()), useAdminConsole
                              (useAdminConfirm, useAdminCrumb), useAdminSort,
                              useLiveRefresh
  server/api/admin/**         the console's API (91 route files, /api/admin/auth/* included)
  server/api/site/**          what the public site reads (published content, media,
                              redirects, settings) and the two signed calls it makes
                              (enquiries, visit totals)
  server/utils/website/**     content workflow, media, redirects, settings,
                              enquiries, analytics
  server/tasks/website/       enquiries-retention (daily, 03:17)
  server/utils/auth.ts        sessions, cookies, requireAuth / requireRole / requireAdmin
  server/utils/staff.ts       requireStaffPermission(event, permission)
  server/utils/staff-auth.ts  the staff sign-in steps and their rate limits
  server/utils/project-lifecycle.ts  cancelProject(), syncProgress()
  server/utils/notify.ts      notify() / notifyRoles(): in-app row + mirrored email
  server/plugins/audit-guard.ts      start-up warning when the audit triggers are missing
  shared/permissions.ts       the role × permission matrix, read by BOTH halves
  shared/catalog.ts           pricing, FIXED_PLAN_MAX_PAYMENTS, planDueDates()
  shared/{cms,enquiry,visits}.ts  re-exports of web/shared/*: one contract, both apps
scripts/create-super-admin.mjs       the first owner (pnpm admin:create)
docs/migrations/2026-11-*.sql        the schema changes, each with its rollback
web/shared/{cms/*,enquiry,visits}.ts  content contract, enquiry signature, visit rules
web/server/utils/{cms,enquiry-forward,visits}.ts  the site's side of each call
```

**One matrix, enforced on the server and drawn in the browser.** Every
`/api/admin/**` handler starts with `requireStaffPermission(event, '<permission>')`
(never a bare `requireAdmin`). That call checks, fresh from the database on
each request, that the caller has a staff session, an `ADMIN` account that is
not suspended, and a `staffRole` holding the permission; otherwise it answers
403 with `data.permission` and the roles that do hold it. The sidebar's
padlocks, the access wall, the Team screen's matrix and every hidden button
read the same `shared/permissions.ts` through `can()`, so the screen cannot
show an action the server would refuse, or the other way round. Hiding is a
convenience; the server is the gate.

**Server conventions** (ADR-013, unchanged): the `prisma` singleton, zod
`validateBody` / `validateQuery` (400 with `data.fieldErrors`), the
`paginated()` envelope `{ items, total, page, pageSize, pageCount }`,
`?sort=&dir=` over a per-list whitelist (`orderFor()`, id tiebreak), and
`recordAudit()` on every staff write.

**Screens** (sidebar groups from `utils/adminNav.ts`):

| Group | Screen | Route | Needs |
|---|---|---|---|
| Overview | Work queue, counts, delivery pipeline, money cards (money roles only) | `/admin` | `work.view` |
| Work | Projects (table, stage tabs, bulk assign) | `/admin/projects` | `work.view` |
| | Project record (timeline, kickoff, deliverables gate, notes, client actions) | `/admin/projects/:id` | `work.view` |
| | Support inbox | `/admin/tickets` | `support.answer` |
| | Services & pricing | `/admin/services` | `work.view` (edit: `catalogue.edit`) |
| People | Clients | `/admin/users` | `work.view` |
| | Client record (credit, two-step reset, suspension) | `/admin/users/:id` | `work.view` |
| | Team & roles (members, invites, the matrix) | `/admin/team` | `team.manage` |
| Money | Payments & credit (ledger, instalments, withdrawals, credit lines, rails) | `/admin/payments` | `money.view` |
| | Credit applications | `/admin/credit` | `money.view` (decide: `credit.approve`) |
| | Agreements | `/admin/contracts`, `/admin/contracts/:id` | `money.view` |
| Website | Pages, with Publish history | `/admin/website/pages` | `website.view` (draft: `website.edit`; publish: `website.publish`) |
| | Page editor (sections, Content/SEO/Revisions, live preview) | `/admin/website/pages/:id` | as above; changing an address that was live needs `website.seo` |
| | Insights, Case studies (and their editors) | `/admin/website/insights`, `/admin/website/case-studies` (+ `/:id`) | as Pages |
| | Media library | `/admin/website/media` | `website.view` (upload, edit, delete: `website.media`) |
| | Navigation & footer | `/admin/website/navigation` | `website.view` (edit and publish: `website.seo`) |
| | SEO & redirects (page SEO, redirects, sitemap & robots) | `/admin/website/seo` | `website.seo` |
| | Enquiries | `/admin/website/enquiries` | `leads.handle` (convert: also `clients.approve`) |
| | Analytics | `/admin/website/analytics` | `analytics.view` |
| System | Site settings (company facts, social, sharing image, maintenance) | `/admin/site-settings` | `website.settings` |
| | Platform settings | `/admin/settings` | `platform.settings` |
| | Audit log | `/admin/audit` | `team.manage` |
| | Email (outbox) | `/admin/mail` | `team.manage` |
| | Tools (broadcast) | `/admin/tools` | `catalogue.edit` |

A destination the role cannot open shows a padlock in the sidebar and the
access wall ("This area needs …") in place of the screen.

**Two-way sync with the client panel** (ADR-025 §Two-way sync): both panels
read the same rows; each event that matters to the other side writes a
notification through `notify()` (client links into `/dashboards/…`, staff
links into `/admin/…`), and open pages re-read their data when one arrives
(`useClientLiveRefresh`, every 60 s while the tab is visible; the console's
sidebar counts every 2 min). Cancelling a project is one function
(`cancelProject()`) that stops its plan and contract in the same
transaction, so neither panel can show a cancelled order still being
charged.

**Payments.** Stripe (cards), GoCardless (Direct Debit) and PayPal are the
source of truth for money that moves; the panel's wallet and ledger change
only when a signed webhook settles an intent, and webhook handling is
idempotent twice over (unique `(provider, providerEventId)` and a
conditional claim on the intent). See [ARCHITECTURE.md §9](docs/ARCHITECTURE.md).
Development and tests use Stripe test mode and the mock rail only.

---

## The website and the console

ADR-026, on `feature/admin-website`. The two apps run on the same box in
production and talk server to server over loopback; a visitor's browser
never calls the console.

| Direction | Call | Authenticated by | If it fails |
|---|---|---|---|
| Site reads content | `GET /api/site/{manifest,page,globals,settings,redirects}`, `/api/site/media/**` | public, read-only (published content only) | the site serves its last good copy from disk (`.data/cms`), else its code baseline |
| Console tells the site to refresh | `POST <site>/api/cms/revalidate` after a publish | bearer `NUXT_WEBSITE_REVALIDATE_SECRET` = site `NUXT_CMS_REVALIDATE_SECRET` | the site's 60-second cache catches up on its own |
| Editor previews a draft | the site's `/preview/:token` in a frame | a 30-minute purpose token; only the panel origins may frame it | saving still works; only the preview is missing |
| Site hands over a contact message | `POST /api/site/enquiries` | HMAC with `NUXT_CMS_ENQUIRY_SECRET` = panel `NUXT_WEBSITE_ENQUIRY_SECRET`, five-minute window | the message still counts as sent if the site's email went; the visitor sees "not sent" only when both failed |
| Site hands over visit totals | `POST /api/site/visits`, once a minute | HMAC with a key derived from the same secret | the totals are kept and retried, up to 2,000 rows |

- **Content.** Pages the site already had are "coded": the editor changes
  their words, not their sections. New pages, articles and case studies are
  "built" from the section types the site renders. Every publish keeps a
  revision, and a revision can be restored. Changing the address of a page
  that was ever live writes a 301 redirect.
- **The site's words stay safe.** An empty field keeps what the code says,
  and no placeholder is ever printed. "Import from site" adds only documents
  that are missing.
- **Enquiries** are kept 24 months unless they became a client. The audit
  log names them by reference (`ENQ-…`), never the person.
- **Visits** are counted without cookies, browser storage, a third-party
  script or a stored IP address. Only totals per London day, page and source
  are kept (`SiteVisit`). A "visit" is a page load that arrived from outside
  the site.
- **Maintenance mode** (Site settings) answers every site page 503 with a
  holding page and the contact email, and closes the contact form (503).
  Staff previews and assets keep working.

---

## Sign-in and sessions

Staff sign in at **`/admin/sign-in`**, never at the customer sign-in.

1. `POST /api/admin/auth/login` — email and password. Only an `ADMIN`
   account gets past it; an unknown address, a wrong password and a
   customer account all get the same 401, so the form cannot be used to
   find out who works here.
2. With two-step on: `POST /api/admin/auth/login-2fa` — the five-minute
   ticket plus an authenticator code or a backup code. A code works once.
3. With two-step off: the account is made to set it up first —
   `POST /api/admin/auth/enrol/start` (QR code and key) and
   `…/enrol/finish` (a code turns it on and returns ten backup codes once).
   No session is issued until then.

| | Customer session | Staff session |
|---|---|---|
| Started by | `/api/auth/login` (+ `login-2fa` if on) | `/api/admin/auth/*` only, code always required |
| `Session.kind` | `customer` | `staff` |
| Cookie | `auth_token`, 7 days, SameSite=Lax | `apex_admin`, httpOnly, **SameSite=Strict**, Secure in production, **12 h** absolute |
| Idle limit | none | **2 h** (`middleware/02.session.ts` ends it on the next request) |
| Accepted by the admin API | no (401 with `data.signIn`) | yes |

- **Separate from signup.** Public signup only ever creates `CUSTOMER`
  accounts. A staff account comes from an invite (`/admin/team`, accepted at
  `/auth/accept-invite`; role and address come from the invite row, the
  single-use token is claimed inside the account-creating transaction, and
  accepting starts no session) or, for the very first owner, from the CLI
  script below.
- **The customer sign-in refuses staff accounts** (403 pointing at the staff
  sign-in), and starting either kind of session clears the other cookie.
- **Rate limits** (`RateLimits.staffLogin`): five attempts per 15 minutes per
  IP and, separately, per address, then a 30-minute block; the code step has
  its own budget per account. Failed attempts are audited
  (`auth.staff.login.failed`, with the reason and IP).
- A suspension or demotion takes effect on the next request: the guard reads
  the account fresh every time, and a sign-in ticket is re-checked before the
  code step.
- Two-step secrets are encrypted at rest (`NUXT_ENCRYPTION_KEY`) in their own
  table. A staff member who loses the phone and the backup codes is reset by
  an owner or admin (`clients.approve`) with a typed, audited reason; nobody
  can reset their own.

---

## Roles and permissions

Eight fixed roles, nineteen permissions, one table: `shared/permissions.ts`.
No per-person overrides. An `ADMIN` account with no `staffRole`, or one the
code does not recognise, is treated as **Owner** (`DEFAULT_STAFF_ROLE`) — the
backfill rule from ADR-016 — so never remove a role from the table.

| Permission | What it allows | Owner | Admin | Project manager | Support | Finance | Read-only | Publisher | Editor |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `work.view` | See projects, clients, the Overview, services | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| `work.assign` | Create, assign, advance, cancel projects; milestones, notes, client actions, kickoff | ✓ | ✓ | ✓ | | | | | |
| `work.release` | Release or withhold a project's files | ✓ | ✓ | ✓ | | | | | |
| `money.view` | Values, plans, payments; collect an instalment; decline a withdrawal; agreements | ✓ | ✓ | | | ✓ | | | |
| `credit.approve` | Decide credit applications, change a line | ✓ | ✓ | | | | | | |
| `money.refund` | Refund; **approve a withdrawal; waive an instalment** | ✓ | | | | ✓ | | | |
| `clients.approve` | Create, suspend, restore clients; edit their company; reset their two-step | ✓ | ✓ | | | | | | |
| `support.answer` | Read and answer support requests, assign, resolve | ✓ | ✓ | ✓ | ✓ | | | | |
| `catalogue.edit` | Services and prices; broadcast notifications | ✓ | ✓ | | | | | | |
| `team.manage` | Invite, change role, suspend staff; audit log; email outbox | ✓ | ✓ | | | | | | |
| `platform.settings` | Platform settings | ✓ | | | | | | | |
| `website.view` | See pages, articles, case studies, media, menus, SEO | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `website.edit` | Draft content and send it for review | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| `website.media` | Upload, describe and delete media | ✓ | ✓ | ✓ | ✓ | | | ✓ | ✓ |
| `website.publish` | Publish, request changes, restore, import from the site | ✓ | ✓ | | | | | ✓ | |
| `website.seo` | Menus, page addresses, redirects, sitemap and robots | ✓ | ✓ | | | | | ✓ | |
| `website.settings` | Site settings (company facts, sharing image, maintenance) | ✓ | | | | | | | |
| `leads.handle` | Enquiries: read, assign, note, mark won or lost | ✓ | ✓ | ✓ | ✓ | | | | |
| `analytics.view` | Website analytics | ✓ | ✓ | ✓ | | ✓ | ✓ | | |

The Website rows are the design's matrix (ADR-026), with its keys mapped
to ours. Publisher and Editor are not in the design and hold only
`website.*` permissions. They stay in the table so an account holding one
keeps working and is not promoted to Owner by the fallback.

Rules the API enforces besides the matrix:

- Nobody can change or suspend their own access, and the last active owner
  cannot be demoted or suspended.
- A reason is required for a role change, a suspension, a refund, releasing
  files early, declining credit and a two-step reset; it is stored in the
  audit row.
- A role without `money.view` is not sent money at all: the Overview's money
  cards, project values and client balances are left out of the response,
  and sorting by value is ignored. A role without `clients.approve` is not
  sent a client's date of birth or gender.

---

## Endpoints

All under `/api/admin/` unless shown otherwise. `:id` is a record id. Lists
take `page`, `pageSize`, their filters, and `sort` / `dir` where noted.

**Sign-in** (no session needed)

| Method | Path | Notes |
|---|---|---|
| POST | `auth/login` | email + password → `{ status: 'two_factor' \| 'enrol', ticket }` |
| POST | `auth/login-2fa` | ticket + code → staff session |
| POST | `auth/enrol/start` · `auth/enrol/finish` | first-time authenticator setup → staff session + backup codes |
| GET · POST | `/api/auth/invite` · `/api/auth/accept-invite` | read an invite by token; accept it (creates the account, no session) |
| POST | `/api/auth/logout` | ends whichever session the browser holds |

**Work**

| Method | Path | Needs |
|---|---|---|
| GET | `stats` | `work.view` (money figures only with `money.view`) |
| GET · POST | `projects` (sort: name, updated, created, deadline, value) | `work.view` · `work.assign` |
| GET · PATCH · DELETE | `projects/:id` | `work.view` · `work.assign` · `work.assign` |
| POST | `projects/:id/advance` · `/kickoff` · `/milestones` · `/notes` · `/actions` | `work.assign` |
| DELETE | `projects/:id/actions/:actionId` | `work.assign` |
| POST | `projects/:id/deliverables/release` · `/withdraw` | `work.release` |
| PATCH · DELETE | `milestones/:id` | `work.assign` |
| GET · PUT | `services` | `work.view` · `catalogue.edit` |

**People**

| Method | Path | Needs |
|---|---|---|
| GET · POST | `users` (sort: name, created) | `work.view` · `clients.approve` |
| GET · PATCH | `users/:id` | `work.view` · `clients.approve` |
| PUT | `users/:id/company` | `clients.approve` |
| POST | `users/:id/two-factor-reset` | `clients.approve` |
| GET | `tickets` (sort: updated, created) · `tickets/:id` | `support.answer` |
| PATCH · POST | `tickets/:id` · `tickets/:id/reply` | `support.answer` |
| GET | `team` | `team.manage` |
| PATCH | `team/:id` | `team.manage` |
| POST · DELETE | `team/invites` · `team/invites/:id` | `team.manage` |
| POST | `team/invites/:id/resend` | `team.manage` |

**Money**

| Method | Path | Needs |
|---|---|---|
| GET | `finance/summary` · `finance/transactions` (sort: date, amount) · `finance/installments` · `finance/withdrawals` · `finance/credit` | `money.view` |
| PATCH | `finance/installments/:id` `{action:'charge'}` | `money.view` |
| PATCH | `finance/installments/:id` `{action:'waive'}` | `money.view` + `money.refund` |
| PATCH | `finance/withdrawals/:id` `{action:'reject'}` | `money.view` |
| PATCH | `finance/withdrawals/:id` `{action:'approve'}` | `money.view` + `money.refund` |
| POST | `finance/refund` | `money.refund` |
| PATCH | `finance/credit/:id` | `credit.approve` (raising or releasing also needs `NUXT_LENDING_CREDIT_DECISIONS`) |
| GET | `credit/applications` | `money.view` |
| POST | `credit/applications/:id/decide` | `credit.approve` (approving also needs the lending switch) |
| GET · PATCH | `contracts` (sort: created, signed, value) · `contracts/:id` | `money.view` |
| GET | `payments/health` | `money.view` |

**Website** (`feature/admin-website`, ADR-026)

| Method | Path | Needs |
|---|---|---|
| GET · POST | `website/documents` (`?collection=pages\|insights\|work\|chrome`) | `website.view` · `website.edit` |
| GET | `website/documents/:id` | `website.view` |
| PUT | `website/documents/:id/draft` | `website.edit` (chrome documents: `website.seo`) |
| POST | `website/documents/:id/submit` · `/withdraw` · `/restore` | `website.edit` |
| POST | `website/documents/:id/publish` · `/request-changes` | `website.publish` |
| POST | `website/documents/:id/preview` | `website.view` (a 30-minute link to the site's `/preview/:token`) |
| PATCH | `website/documents/:id/path` | `website.edit`; `website.seo` once the page was live (writes a 301) |
| GET | `website/history` · `website/review-counts` · `website/seo` | `website.view` |
| POST | `website/import` | `website.publish` (adds only missing documents) |
| GET · POST | `website/media` | `website.view` · `website.media` |
| PATCH · DELETE | `website/media/:id` | `website.media` (delete refused while in use) |
| GET · POST | `website/redirects` | `website.view` · `website.seo` |
| POST · DELETE | `website/redirects/check` · `website/redirects/:id` | `website.seo` |
| GET · PUT | `website/settings` | `website.view`, then per key: `site.*` needs `website.settings`, robots needs `website.seo` |
| GET | `website/enquiries` (`?filter=&q=`) · `website/enquiries/summary` · `website/enquiries/:id` | `leads.handle` |
| PATCH · POST | `website/enquiries/:id` · `website/enquiries/:id/notes` | `leads.handle` |
| POST | `website/enquiries/:id/convert` | `leads.handle` + `clients.approve` |
| GET | `website/analytics?days=7\|14\|30\|90` | `analytics.view` |

**Public, for the site** (no session; under `/api/site/`)

| Method | Path | Notes |
|---|---|---|
| GET | `manifest` · `page?path=` · `globals` · `settings` · `redirects` | published content only; cacheable |
| GET · HEAD | `media/**` | media-library files, a year's immutable cache |
| GET | `preview/:token` | a draft, for a valid 30-minute token only |
| POST | `enquiries` | signed (HMAC, five minutes); idempotent on the site's id; 503 without the secret |
| POST | `visits` | signed with the derived visits key; a batch id counts once; 503 without the secret |

**System**

| Method | Path | Needs |
|---|---|---|
| GET · PUT | `settings` | `platform.settings` |
| GET | `audit` (sort: date; kind filter; the screen exports the filtered set as CSV) | `team.manage` |
| GET · POST | `mail` · `mail/test` · `mail/:id/retry` | `team.manage` |
| POST | `notifications/broadcast` | `catalogue.edit` |

**Development only** (404 in a production build): `POST /api/_test/reset-rate-limits`,
`GET /api/_test/mail`, `POST /api/_test/two-factor-reset` — used by the test
harness.

Answers: 401 without a staff session (`data.signIn` names the staff
sign-in), 403 with `data.permission` when the role lacks it, 400 with
`data.fieldErrors` for a bad body, 404 for a record that does not exist,
409 for a move the record's state refuses.

---

## Money guardrails

The owner's rules, enforced in the server, not only in the screens:

- **The 12-month instalment plan is zero-cost.** No admin control adds
  interest, late fees, admin fees or any other charge to it, and there is no
  price difference between paying in full and paying in instalments (a unit
  test checks every fixed plan). The catalogue editor refuses more than
  **12 payments** (`FIXED_PLAN_MAX_PAYMENTS`), and an older stored catalogue
  is read as 12.
- **Never past 12 months from the agreement date.** `planDueDates()` spaces
  the payments a month apart, or, when the last would land after
  `Project.signedAt` + 12 months, compresses them evenly to end on that day
  (the owner's choice over refusing a late kickoff). Amounts never change.
  Kickoff, charging, waiving and both panels' schedules all use it. Agreements
  signed from `apex-msa-2026-11` state the limit.
- **Regulated lending is off.** The 24-month 1%-a-month plan and approving
  or raising credit lines sit behind `NUXT_LENDING_INTEREST_BEARING_PLANS`
  and `NUXT_LENDING_CREDIT_DECISIONS`, both **off by default** and settable
  only in the environment. Declining, freezing and lowering still work.
- **No hand-edited money.** The free-form wallet credit/debit route is gone;
  a signed project's value cannot be edited (409); refunds go back the way
  the money came (a top-up through the provider's refund API, with the wallet
  debited first and restored once if the provider refuses).
- Approving a withdrawal and waiving an instalment need `money.refund`.

Removed from the design for these rules: the Platform settings "24-month
financing" switch and the client record's wallet adjustment.

---

## Audit log and data

- Every staff write calls `recordAudit()`: actor, the role they held at the
  time, action, target, before/after values, reason where one is required,
  IP and time. Failed staff sign-ins are recorded too.
- **Append-only, in the database.** Two SQLite triggers refuse `UPDATE` and
  `DELETE` on `"AuditLog"`; no route edits a row, and the screen has no edit
  or delete control. Prisma does not manage triggers, so a `prisma db push`
  that rebuilds the table drops them; the panel then logs
  `[audit-append-only]` at start-up until the hardening SQL is re-run.
- **UK GDPR minimisation.** List views carry only what their rows show (the
  Clients list has no city, country, balances or verification date; a phone
  only for an account with no email); a client record leaves out money for
  roles without `money.view` and date of birth and gender for roles without
  `clients.approve`.

---

## Migrations

The branch adds two schema changes; everything else the console reads
already exists in production (deployed 2026-10-28). Both are additive and
carry their rollback at the bottom of the file.

| File | What | Rollback |
|---|---|---|
| [`docs/migrations/2026-11-staff-sessions.sql`](docs/migrations/2026-11-staff-sessions.sql) | `Session.kind TEXT NOT NULL DEFAULT 'customer'` | `ALTER TABLE "Session" DROP COLUMN "kind"` (SQLite 3.35+), with the previous build restored |
| [`docs/migrations/2026-11-admin-hardening.sql`](docs/migrations/2026-11-admin-hardening.sql) | 8 indexes (Project, Ticket, User, Transaction) and the two append-only triggers on `AuditLog`; safe to run twice | drop the triggers and indexes (listed in the file) |

**Applied in production on 2026-11-01** (backup
`/opt/apex/backups/dev.db.20261101-124554.pre-admin-console`, the SQL and the
previous schema beside it). Production's database is
`/opt/apex/prisma/dev.db`, not `/opt/apex/dev.db`. Order for a deployment
(only on the owner's go-ahead):

1. Stop the panel and back up the database
   (`cp -p /opt/apex/prisma/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-admin-console`).
2. `sqlite3 /opt/apex/prisma/dev.db < 2026-11-staff-sessions.sql`, then
   `sqlite3 /opt/apex/prisma/dev.db < 2026-11-admin-hardening.sql`.
3. Copy the branch's `prisma/schema.prisma` beside the database, ship the
   bundle (`scripts/ship-bundle.sh`), start the panel.
4. Check the start-up log has no `[audit-append-only]` warning, and that
   `/admin/sign-in` answers 200 and `/api/admin/stats` 401.

Locally, `pnpm exec prisma db push` applies the column and indexes; run the
hardening SQL afterwards for the triggers.

### The Website group (ADR-026, applied in production 2026-11-02)

The content tables (`SiteDocument`, `SiteRevision`, `SiteRedirect`,
`SiteMedia`, `SiteMediaRef`) have been in production since 2026-10-28
(ADR-021), so the branch adds only these:

| File | What | Rollback |
|---|---|---|
| [`docs/migrations/2026-11-website-legacy.sql`](docs/migrations/2026-11-website-legacy.sql) | archives the October CMS's documents and moves their addresses aside (`~legacy-<id>`); deletes nothing. Run **once**, before the first Import | in the file |
| [`docs/migrations/2026-11-enquiries.sql`](docs/migrations/2026-11-enquiries.sql) | `Enquiry`, `EnquiryNote` and their indexes | drop both tables |
| [`docs/migrations/2026-11-site-visits.sql`](docs/migrations/2026-11-site-visits.sql) | `SiteVisit` and its indexes | drop the table |

The enquiry and visit migrations were applied and rolled back on copies of
the local database. **Applied in production on 2026-11-02**: the check
showed the 33 documents of the October import (all published, no media,
no redirects) and archived all 33; backup
`/opt/apex/backups/dev.db.20261102-005815.pre-website`, the three SQL files
and the previous schema beside it; integrity ok, other row counts
unchanged. The enquiry pair and `NUXT_WEBSITE_PUBLIC_URL=https://apexdigi.co.uk`
were added to both env files (backups `*.bak.20261102-005755`). Order for a
deployment (only on the owner's go-ahead):

1. On the box, run the check `SELECT` at the top of
   `2026-11-website-legacy.sql` and read what it would archive.
2. Set the secret pair (below) in both env files, and
   `NUXT_WEBSITE_PUBLIC_URL` on the panel if it is not there.
3. Stop the panel, back up the database
   (`cp -p /opt/apex/prisma/dev.db /opt/apex/backups/dev.db.$(date +%Y%m%d-%H%M%S).pre-website`),
   then run the three files in the order above.
4. Copy the branch's `prisma/schema.prisma` beside the database, ship the
   panel (`scripts/ship-bundle.sh`) and then the site (`scripts/ship-web.sh`).
5. Sign in as the owner and run **Website › Pages › Import from site**. Until
   then the site renders its code baseline, which is identical.
6. Check: a site page 200; `/api/site/manifest` 200; an unsigned
   `POST /api/site/enquiries` 401; one contact message arrives in
   Enquiries; a minute after browsing the site, Analytics shows a visit.

---

## Environment variables

New on this branch (documented in [`.env.example`](.env.example)):

| Variable | Default | Meaning |
|---|---|---|
| `NUXT_LENDING_INTEREST_BEARING_PLANS` | unset = off | Allows the legacy 24-month plan at 1% a month. Leave off until the owner confirms the lending position. |
| `NUXT_LENDING_CREDIT_DECISIONS` | unset = off | Allows approving credit applications, raising a limit and releasing a held line. Set to `true` only on the owner's word. |

For the Website group (`feature/admin-website`; panel in [`.env.example`](.env.example),
site in [`web/.env.example`](web/.env.example)):

| Panel | Site | Meaning |
|---|---|---|
| `NUXT_WEBSITE_SITE_URL` | `NUXT_CMS_URL` | each app's loopback address for the other (production: `http://127.0.0.1:3100` and `http://127.0.0.1:3000`) |
| `NUXT_WEBSITE_REVALIDATE_SECRET` | `NUXT_CMS_REVALIDATE_SECRET` | the same long random value; unset, the site picks up a publish within a minute |
| `NUXT_WEBSITE_ENQUIRY_SECRET` | `NUXT_CMS_ENQUIRY_SECRET` | the same long random value. **New.** Signs contact messages and, through a derived key, the visit totals; unset, neither reaches the console |
| `NUXT_WEBSITE_PUBLIC_URL` | | the site's public address, for preview links and the editor's frame |
| `NUXT_WEBSITE_MEDIA_DIR` | | media-library files, outside the bundle (production: `/opt/apex/site-media`, already there) |
| | `CMS_PANEL_ORIGINS` | build time: extra console origins allowed to frame `/preview/**` |

The first three pairs and the media directory were set in production for
the October CMS and are still there; check each value before deploying.
Only the enquiry pair is certainly missing. Never reuse the dev values
from the tracked `.demo/.env` and `web/.env`.

Existing variables the console depends on:

| Variable | Why |
|---|---|
| `NUXT_JWT_SECRET` | signs both kinds of session; production warns when it is the fallback |
| `NUXT_ENCRYPTION_KEY` | encrypts two-step secrets (falls back to the JWT secret) |
| `NUXT_PUBLIC_SITE_URL` | builds invite, reset and notification links (required in production) |
| `NUXT_MAIL_RESEND_API_KEY`, `NUXT_MAIL_FROM` | email for invites, resets and notifications; unset, the console says what was not sent and hands the link over |
| `NUXT_PAYMENTS_*` | provider keys (ADR-015). Use **test-mode** keys anywhere but production; live keys are inert until `payments.live-mode` is on |
| `NUXT_UPLOAD_DIR` | where client uploads are stored |

---

## The first Super Admin

There is no web route that creates staff from nothing: signup makes
customers and invites need someone to send them. The first owner is made by
whoever has shell access to the database:

```bash
pnpm admin:create --email owner@apexdigi.co.uk --name "First Last"
```

On a server, point it at the database and the panel's public address:

```bash
DATABASE_URL=file:/opt/apex/prisma/dev.db NUXT_PUBLIC_SITE_URL=https://panel.apexdigi.co.uk node scripts/create-super-admin.mjs --email owner@apexdigi.co.uk --name "First Last"
```

What happens:

1. The script creates an `ADMIN` account with staff role **Owner** and **no
   usable password**, and prints a one-time reset link valid for 60 minutes.
   Nothing else secret is printed.
2. The owner opens the link and chooses a password (12 characters minimum).
3. They sign in at `/admin/sign-in`; the console makes them set up an
   authenticator app before giving them a session, and shows ten backup
   codes once. Keep those somewhere safe.
4. Everyone else is invited from **Team & roles**.

It refuses when an active owner already exists (pass `--allow-additional`
only if a second owner is really wanted) and refuses an address that already
has an account. Existing `ADMIN` accounts from before this branch keep their
role and, on their first staff sign-in, are asked to set up the
authenticator app.

---

## Tests

Run against a dev server on a local database (never production):

```bash
pnpm test:cms:unit
```

```bash
CMS_TEST_URL=http://localhost:3000 SITE_TEST_URL=http://localhost:3001 pnpm test:cms:api
```

The Website suites need the site's dev server too (`pnpm web:dev`, or the
preview config `web`, on :3001); without `SITE_TEST_URL` the tests that go
through the site are skipped.

```bash
E2E_URL=http://localhost:3000 pnpm e2e
```

```bash
pnpm test:tsc-demo
```

| Suite | What it covers | Last run (2026-11-02) |
|---|---|---|
| Unit (`.demo/tests/unit`, `web/tests/unit`) | permissions, plan limits and dates, mail rendering, recipient rules, the site content contract and documents, media sniffing, enquiry and visit signing, visit paths and sources | 62/62 |
| API (`.demo/tests/api`) | staff sign-in and enrolment, money guardrails, sorting and audit triggers, panel sync, **every admin route × every role**, mail flows, website content and publishing through the site, media, redirects and settings, enquiries and their retention, visit totals and the analytics report | 67/67 |
| Browser (`.demo/tests/e2e`, Playwright on installed Edge) | staff sign-in with a code, every screen for the owner, the access wall for Support, no Waive for Admin, customer pages, staff refused at the customer sign-in, one request across both panels, every Website screen for the owner and the wall for each other role | 14/14 (one customer-page timeout under a parallel production build, passed on rerun) |
| Types | `vue-tsc` over the panel; `nuxi typecheck` over the site | 46 errors, the pre-existing baseline (none in console files); site clean |
