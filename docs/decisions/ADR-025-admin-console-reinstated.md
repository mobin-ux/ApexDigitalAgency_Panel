# ADR-025 — The admin console is reinstated, without the website CMS

**Status:** Accepted (2026-11-01). Supersedes the admin half of ADR-024;
the CMS half of ADR-024 stands.

## Context

ADR-024 removed the admin console and the website CMS on 2026-10-31. The
next day the owner asked for the console in `Admin Console.dc.html` to be
built as production code, with separate staff sign-in, two-step
verification for staff, an append-only audit log and money guardrails, on
a feature branch (`feature/admin-console`) rather than straight to master.

That design is the one built on 2026-10-31 (gates 1–7, `5cc9069` to
`f1577ae`): the file was last edited at 21:36 UTC on 2026-10-30, before
the first gate's commit. The schema was never touched by ADR-024, so the
work could be brought back with git.

## Decision

- **Restored from `54b70f8^`:** every `/admin/**` screen except the Website
  group, the console shell and its components, `/api/admin/**` except
  `/api/admin/website/**`, `server/utils/staff.ts`, the staff invite flow
  (`/auth/accept-invite`, its API and email), `shared/audit-kinds.ts`, the
  admin links in staff notifications and the account menu, and the tests
  that covered them.
- **Not restored:** the website CMS (`/api/site/**`, `server/utils/website/**`,
  the publish task, the CMS editor components and the nine Website screens).
  The site keeps rendering its words from code, as ADR-024 decided. The
  design's Website group, the Overview's website card and content-review
  queue, and the palette's document search are left out.
- **Publisher and Editor stay in the matrix** with only `website.*`
  permissions, so an account holding one is not silently promoted to owner
  by `isStaffRole()`'s fallback. Such an account reaches the console's
  access wall and nothing else; `homeFor()` returns null for it rather than
  redirecting in a loop.
- `cms-review` stays a mail kind so earlier outbox rows can still be
  filtered on the Email screen; nothing queues it.

## Hardening that follows (phases on `feature/admin-console`)

1. Separate staff sign-in with its own session kind and cookie, two-step
   verification required for staff, a stricter sign-in limit, and the first
   Super Admin (the Owner role) created by a CLI script.
2. Money guardrails: fixed plans capped at 12 payments, the 12-month rule
   from the agreement date, interest-bearing plans and credit decisions
   behind flags that are off by default, refunds through the payment
   provider, and no free-form wallet edits.
3. Server-side sorting and indexes, an append-only audit log enforced in the
   database, and less personal data in list views.
4. Tests for every admin endpoint and role, and smoke tests in a browser.

`ADMIN_CONSOLE.md` documents the result.
