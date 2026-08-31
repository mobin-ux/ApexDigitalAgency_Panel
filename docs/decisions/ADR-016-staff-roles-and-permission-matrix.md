# ADR-016 — Staff roles: one permission matrix, shared by the UI and the server

**Status:** Accepted (2026-08-31) — introduced by V2 Phase 9 Admin
(`Admin - Team & Platform.dc.html`). Extends, and does not replace, the
`Role` enum gate from ADR-013.
**Context:** the admin panel had exactly one privilege level. Any account
with `role: ADMIN` could refund a payment, change the credit ceiling,
suspend a client, edit the catalogue and read the audit log. The Phase 9
design asks for six staff roles across eleven permissions, and states
(badge 26) that the matrix on screen must *be* the enforcement, not a
picture of it.

## 1. Two gates, not one

`Role` (`CUSTOMER` / `ADMIN` / `EMPLOYEE`) is unchanged and still answers
one question: **can this account reach the admin panel at all**. It is the
coarse gate, checked by `requireAdmin`, the `admin` route middleware and
the login flow.

`User.staffRole` — a new, nullable column — answers the second question:
**what may they do once inside**. Six values, fixed, no per-user
overrides: `owner · admin · pm · support · finance · readonly`.

Keeping them separate was deliberate. Folding the six roles into the
`Role` enum would have meant a destructive migration of a column that
already gates login, the customer/admin split and every existing session
token. A nullable additive column changes nothing for anyone until it is
set.

**"Staff" therefore means `role: ADMIN`.** `EMPLOYEE` remains what it has
always been — a project-assignment label used by `managedProjects`, with
no panel access — and this ADR does not change that. Giving someone the
Project manager *staff role* means `role: ADMIN` + `staffRole: 'pm'`.

## 2. One object, both halves of the app

`shared/permissions.ts` holds the six roles, the eleven permissions and
the allow-lists. It is imported by:

- **the server**, via `server/utils/permissions.ts` →
  `requireStaffPermission(event, 'money.refund')`, which every
  `/api/admin/**` route now calls in place of `requireAdmin`;
- **the client**, via `useStaffAccess()` → the sidebar's padlocks, the
  blocked-page wall, and the role matrix rendered on `/admin/team`.

There is no second copy. The matrix screen is a `v-for` over the same
array the 403 is thrown from, which is what badge 26 asks for: a tick on
the matrix and a refusal from an endpoint cannot say different things,
because they are reading the same rows.

The 403 message names the roles that *do* hold the permission
("Your role (Project manager) cannot do this. Owner, Admin or Finance
can."), so an API client gets the same explanation the wall gives a
person.

## 3. Why retrofitting the gate was safe

All 38 pre-existing `/api/admin/**` routes were moved from `requireAdmin`
to `requireStaffPermission` with a per-route permission. This is
behaviour-identical today because:

- every account that could already reach the panel is backfilled to
  `owner`, which holds all eleven permissions; and
- `staffRoleOf()` falls back to `owner` for any admin row where
  `staffRole` is null, so a missed backfill cannot lock anyone out.

Behaviour only diverges once someone is deliberately given a narrower
role — which is a new capability, not a change to an old one. Verified
after the retrofit: all 11 admin pages and 15 admin APIs still answer 200
for an owner, and the six customer pages are untouched.

**Mapping note.** The matrix has eleven permissions and the API has more
than eleven verbs, so some routes share one. Money *reads* (summary,
transactions, withdrawals, installments, contracts, wallet adjustment)
gate on `money.view`; the destructive one keeps its own row
(`money.refund`, Owner and Finance only); credit-limit changes use
`credit.approve`. Client-record reads use the universal `work.view` row,
because Read-only's stated scope is "reading projects and clients".

## 4. Suspension had to end a live session

`requireRole` checked the role fresh from the database but never the
status, and sessions are stateless seven-day JWTs. Suspending a
colleague therefore blocked their *next sign-in* while leaving them
working in the panel until their cookie happened to expire — which is not
what the button says it does. `requireRole` now refuses a `SUSPENDED`
account, so withdrawal of access takes effect on the next request.
Verified with two cookie jars: 200 → 403 on the same cookie the moment
suspension lands, and 403 → 200 on restore.

## 5. Invites are records, not access

`StaffInvite` (email, name, role, single-use token, 7-day expiry,
`acceptedAt` / `cancelledAt`) exists so the panel can show who has been
asked without listing them as staff (badge 24). Creating one grants
nothing.

`POST /api/auth/accept-invite` is the only route in the app that can
create an account with a role other than `CUSTOMER`, and it can only do
so because a member holding `team.manage` already chose the address and
the role. **Neither is read from the request body** — both come from the
invite row — so a crafted payload cannot pick its own privileges. The
invite is claimed with a conditional update inside the same transaction
that creates the user, so two racing submissions cannot both succeed.

**There is no mail provider in this stack, so nothing is emailed.** The
acceptance link is returned to the caller and the panel says plainly that
the operator must pass it on. Reporting "invite sent" while no message
left the building would be the discarded-file defect Phase 6 removed from
the support composer.

## 6. Consequences

- Adding a permission means adding a row to one array and gating the
  routes that need it; the matrix screen and the padlocks follow for free.
- The eleven permissions are a fixed vocabulary. A twelfth is a design
  change, not a config change — which is the point of "fixed roles, no
  per-user overrides".
- `staffRole` is not in the JWT. It is read from the database on every
  privileged request, so a demotion applies immediately rather than at
  the next login — the same reasoning ADR-013 applied to `role`.
- The client-side gates (`useStaffAccess`) are convenience only. They
  decide what is worth rendering; the server decides what is allowed.
