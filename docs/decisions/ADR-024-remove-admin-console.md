# ADR-024 — The admin console and the website CMS are removed

**Status:** Accepted (2026-10-31); amended 2026-11-03 (the site links to the client panel again, below). Supersedes ADR-021 (website CMS) and the
admin screens of ADR-013, ADR-016 and ADR-017. Amends ADR-018: the site no
longer links to the panel at all.

## Context

The owner asked for the panel to be removed and only the public site kept.
Asked how far that went, they chose: remove the **admin console only** (the
customer panel stays), render the site's words **from code only**, and send
the site's order and sign-in links to **Contact**.

## Decision

Removed from the panel (`.demo/`):

- every `/admin/**` page, `layouts/admin.vue`, the `admin` route middleware,
  the `Admin*` components and their helpers (`useAdminConsole`,
  `useStaffAccess`, `utils/adminNav|adminUi|adminFormat|cmsEditor|roleTone`),
  and the V2 admin shell pieces nothing else used (`ApexAccountMenu`,
  `ApexSidebarNav`, `ApexShell`, `ApexPageHeader`, `ApexSectionLabel`,
  `useApexDrawer`);
- every `/api/admin/**` route (86 files) and `server/utils/staff.ts`;
- the CMS backend: `/api/site/**`, `server/utils/website/**`, the
  `website:publish-due` task, `shared/cms.ts` (the import of the site's
  contract), `shared/media-sniff.ts`, `shared/audit-kinds.ts`, the
  `website` runtime config and the `/api/site/` cache exemption;
- the staff invite flow (`/auth/accept-invite`, `/api/auth/invite`,
  `/api/auth/accept-invite`, the invite email) and the `cms-review` email.

`/api/config` no longer carries `legal` or `announcement`; the legal pages
show their placeholder, the panel announcement bar is gone, and the
dashboard promo comes from `shared/panel-baseline.ts`.

Removed from the site (`web/`): the CMS client (`server/utils/cms.ts`,
`/api/cms/**`, the redirects middleware, the IPX disk cache and `/media`
proxy, the settings and robots plugins), landing pages (`[...slug].vue`,
`components/cms/*`), the preview page, `useSiteSettings`, `useCmsMedia` and
`usePanelLinks`. `useCmsContent()` and `useCmsRecord()` now return the code
baseline, validated once against its template (`shared/cms/validate.ts`).
The contract lost what only the panel used: workflow, sections, blocks,
media and custom fields, panel links, and the landing, legal and panel
templates. "Client login" and "Client dashboard" are gone; every "Start your
order" opens `/contact?service=…&plan=…`.

## Kept on purpose

- **The permission matrix** (`shared/permissions.ts`). Staff accounts and
  their roles still exist and still gate attachments, avatars and staff
  notifications. Dropping the Publisher and Editor roles would make
  `isStaffRole()` fall back to `owner` for those accounts.
- **The database schema.** No table or column is dropped: `SiteDocument`,
  `SiteMedia`, `StaffInvite`, `AuditLog` and the rest stay as they are, so
  production needs no migration and nothing is lost if this is reversed.
- **Staff notifications** (new order, customer reply, client file, answered
  action) still go in-app and by email, now without a link to a screen
  that no longer exists.

## Consequences

- Nothing in the panel lets staff act any more: reply to support requests,
  decide credit applications, collect kickoff payments, release
  deliverables, assign projects, refund, manage the team, or change platform
  settings. Customers can still place orders, apply for credit and open
  requests, and these wait until staff act some other way.
- Copy on the site is changed in code (`web/app/data/`) and needs a deploy.
- Deploying this leaves `NUXT_WEBSITE_*` (panel) and `NUXT_CMS_*`,
  `NUXT_PUBLIC_PANEL_URL` (site) unused; they can be removed from the
  server's env files. Anything that was published through the CMS in
  production stops showing, and the site renders its code baseline.
- Rolling back is `git revert` of the removal commit; the data is intact.

## Amendment (2026-11-03): the site links to the client panel again

The owner asked for links to the client panel on the site: Log in and Sign
up in the header, a column in the footer, and ordering from the service
plans. The site still reads nothing from the panel (its content comes from
the console server to server, ADR-026); it only links to it.

- `NUXT_PUBLIC_PANEL_URL` is in use again, read at run time by
  `usePanelLinks()` (`web/app/composables`). Empty or not an http(s)
  origin: every panel link is left out and the plan buttons open Contact,
  as before.
- Header: "Log in" (from `md`) and "Sign up" (from `lg`) beside "Get in
  touch"; both in the mobile menu. Footer: a "Client panel" column with Log
  in, Create an account and Start an order.
- Every plan's "Start your order", and the homepage plan explainer's, opens
  the panel's New order at `/dashboards/services?service=&plan=` with the
  panel's own ids (`web/app/data/panel.ts` maps the site's slugs and the
  two plan ids the panel spells differently). A signed-out visitor goes
  through sign-in or sign-up and arrives at the order (`?redirect=`).
  `.demo/tests/unit/site-order-links.test.ts` checks every plan the site
  sells lands on itself, since the wizard falls back to the featured plan
  for an id it does not know.
- Software keeps its scoping call on Contact; questions and "Book a call"
  stay on Contact.
- The words live in `web/app/data/panel.ts`, not the header and footer
  templates, so the change needed no panel deploy.
- Still open (`web/app/data/plans.ts` TODO): the panel prices from its own
  catalogue, which has no deposits and no 6-month term, so a card's figures
  and the checkout's can differ until one of the two catalogues is changed.
