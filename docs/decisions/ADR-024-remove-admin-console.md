# ADR-024 — The admin console and the website CMS are removed

**Status:** Accepted (2026-10-31). Supersedes ADR-021 (website CMS) and the
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
