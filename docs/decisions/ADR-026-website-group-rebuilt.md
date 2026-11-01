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
