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
4. Two-way sync with the client panel.
5. Tests for every admin endpoint and role, and smoke tests in a browser.
6. `ADMIN_CONSOLE.md`: architecture, roles and permissions, endpoints,
   migrations, env vars and the first Super Admin.

## Money guardrails (phase 2, 2026-11-01)

The owner's rules for the instalment plan: it stays exactly zero-cost, with
no interest, fees or price difference from paying in full, and no plan runs
past twelve months from the agreement date. Asked what should happen when a
late kickoff would carry the last payment past that, the owner chose to
**compress the dates** rather than refuse the kickoff.

- **Twelve payments at most.** The catalogue editor refuses more
  (`FIXED_PLAN_MAX_PAYMENTS`), and `paymentCount()` reads a stored catalogue
  from before the cap (the editor once accepted 36) as twelve, so no order
  can be priced over a longer term. A unit test checks that every fixed plan
  costs the same in full as in instalments.
- **Twelve months from signing.** `planDueDates()` in `shared/catalog.ts` is
  the one rule: payments a month apart, or, when the last would land after
  `Project.signedAt` + 12 months, spaced evenly from the first to that day.
  Amounts never change. `collectKickoff` sets the first date with it,
  `chargeInstallment` and the admin waiver step `nextDue` with it, and the
  client and admin schedules draw from it, so the date shown is the date
  charged. A kickoff after the deadline makes every remaining payment due at
  once. The client is told in the kickoff notification. Agreements signed
  from now on (`apex-msa-2026-11`) state the limit; earlier contracts keep
  the text they were signed with. Retainers and legacy interest-bearing
  plans are not under the rule (`underPlanLimit`).
- **Lending switches in the environment, off by default**
  (`runtimeConfig.lending`): `NUXT_LENDING_INTEREST_BEARING_PLANS` (the
  24-month 1%-a-month plan: `planFor(…, 24)` refuses while off, and
  `/api/config` reports it) and `NUXT_LENDING_CREDIT_DECISIONS` (approving
  an application, raising a limit, releasing a held line). Declining,
  freezing and lowering stay available. The Platform settings
  "24-month financing" switch, default on and read by nothing since Panel v2,
  is gone, replaced by a statement of the terms.
- **No hand-edited money.** The free-form wallet credit/debit
  (`POST /api/admin/users/:id/wallet`) is removed. A signed project's value
  can no longer be edited (409), since it would show the client a total that
  differs from their agreement.
- **Refunds by the route the money came.** A top-up goes back through the
  provider's refund API (`refundTopUp`): the wallet is debited, and the
  Refund, ledger row and journal are written in one transaction. Only what
  is still in the wallet can go back. The provider is called afterwards with
  the Refund id as idempotency key. A refusal, from the call or a later
  `refund.failed` webhook, returns the money once (`reverseRefund` claims
  processing → failed). A payment taken from the wallet is refunded to the
  wallet, as before. A direct-debit collection is refused with a pointer to
  the provider: refunding that rail from the panel is not built.

Not changed, and stated so: credit lines themselves (ADR-020) carry no
interest; whether lending on them to sole traders needs authorisation is
the owner's question to take advice on, which is why approvals are behind
the switch.

## Data hardening (phase 3, 2026-11-01)

- **Sorting on the server.** Lists were already paged and filtered in the
  database; their order was fixed. `sortQuerySchema()` + `orderFor()`
  (`server/utils/http.ts`) give projects, clients, transactions, agreements,
  support and the audit log `?sort=&dir=` over a whitelist per list (an
  unknown column is a 400), with the id as a tiebreak so pages never repeat
  or skip a row. A role without `money.view` cannot sort by value: the
  order would reveal what the column hides. The Projects, Clients and
  Payments tables' existing column headings became `AdminSortHeader`
  buttons. The screens built from the design had no sort control, so this
  is the smallest addition that meets the requirement, not a design element.
- **Indexes** for those orders and filters: Project (status+updatedAt,
  userId, managerId), Ticket (status+updatedAt, userId, assigneeId), User
  (role+createdAt), Transaction (type+createdAt). Project and Ticket had
  none.
- **Append-only audit log in the database**: two triggers refuse UPDATE and
  DELETE on "AuditLog" (Prisma surfaces the refusal as a constraint error).
  No code ever modified a row; now the database refuses it too. Prisma does
  not manage triggers and a `db push` that rebuilds the table drops them, so
  `server/plugins/audit-guard.ts` warns at start-up when they are missing.
  SQL and rollback: `docs/migrations/2026-11-admin-hardening.sql`.
- **Minimisation (UK GDPR).** The Clients list carries only what its rows
  show: city, country, balances and verification date are gone, and the
  phone is sent only for an account with no email. A client's record leaves
  out balances, ledger rows and project values for roles without
  `money.view`, and date of birth and gender for roles without
  `clients.approve`. Before this, both went to every staff role, including
  Read-only and Support.
- **Not built:** a data export or erasure-request screen. The console as
  designed has none, and erasure has to respect what UK law requires the
  business to keep (signed agreements, payment records); that is a policy
  decision to make before it is a screen.

## Two-way sync with the client panel (phase 4, 2026-11-01)

Staff and clients work on the same rows, so a change made in one panel is
what the other reads next; this phase made sure each event also tells the
other side, and that no staff action leaves the two panels disagreeing.

- **Cancelling is one path.** `cancelProject()` (`server/utils/project-lifecycle.ts`)
  sets the project CANCELLED, stops its unsettled plan (`Installment.status =
  'cancelled'`, nothing due) and cancels its live contract, in the caller's
  transaction. The project screen and Agreements both use it. Before this,
  a cancelled project's plan stayed active: auto-pay, the client's Pay
  button and the Overview's overdue list all still treated it as owed.
  Now `chargeInstallment` and the waiver refuse it (409), the kickoff
  refuses a cancelled project, the credit line stops counting it, and the
  client's schedule (`orderSchedule`) keeps only what was paid and says
  payments stopped. A cancelled project or agreement cannot be brought
  back (409); a new order is the way. Money already taken is untouched;
  a refund stays its own audited action.
- **Status moves that would split the panels are refused.** A paid-kickoff
  order cannot be set to In progress by hand (409 pointing at "Kickoff done
  · collect", which takes the payment and starts the plan), and a project
  whose kickoff was taken cannot go back to awaiting kickoff. A waiver is
  refused on a plan that has not started.
- **Progress follows the timeline.** Adding, editing or removing a
  milestone recomputes the project's progress in the same write
  (`syncProgress`), as advancing a stage already did.
- **Staff actions the client now hears about:** a status change (in
  progress, ready for review, complete, cancelled), a new target date, a
  completed stage, a request resolved or closed, a withdrawal approved or
  declined, files put back on hold. **Client actions staff now hear
  about:** a new support request, resolving or reopening one, asking for
  or moving a call (all through `notifyTicketHandler`: the assignee, else
  the order's manager, else everyone holding `support.answer`), and a
  credit application made or withdrawn (`credit.approve`). A project or
  request assigned to someone tells that person. Client notices link into
  `/dashboards/…`, staff notices into `/admin/…`.
- **Open pages catch up.** The customer shell re-reads notifications when
  the tab comes back into view and every minute while it is visible; a new
  one reloads the order, support and wallet data on screen
  (`useClientLiveRefresh`). The console's sidebar counts do the same every
  two minutes. A hidden tab makes no requests.
- **Not built, by the design:** the console has no notification bell; staff
  see client activity in the Overview queue and the sidebar counts, and
  their notification rows are emailed once mail is configured (ADR-022).

## Tests for every endpoint and role, and browser smoke tests (phase 5, 2026-11-01)

- **The matrix is the test's expected answer.** `tests/api/admin-roles.test.ts`
  calls all 58 admin routes as each of the eight staff roles, a customer and
  nobody, and reads the expected outcome from `shared/permissions.ts`: a
  role without the permission gets a 403 naming it, a role with it gets past
  the guard (never a 401, 403 or 500), a customer gets a 403 and no session a
  401. Writes go to an id that does not exist with an empty body, so nothing
  in the database moves. The suite also fails when a route file exists that
  has no row in its table, so a new endpoint cannot ship untested.
- **Two money actions were tightened.** Approving a withdrawal (money out of
  a wallet) and waiving an instalment (money forgiven) only needed
  `money.view`, so the Admin role could do both while being refused a
  refund. Both now need `money.refund` (Owner, Finance), the permission the
  matrix describes as refunding; declining a withdrawal and collecting an
  instalment still need only `money.view`. Payments hides Approve and Waive
  for a role without it.
- **Smoke tests in a browser** (Playwright 1.56.1, `pnpm e2e`,
  `playwright.config.ts`, `.demo/tests/e2e`): the staff sign-in with a
  computed authenticator code; every console screen and a project and client
  record opening for the owner with no page error and no failed request; the
  access wall for a support agent exactly where the matrix withholds; no
  Waive button for an admin; a customer signing in and opening the five panel
  pages; a staff account sent from the customer sign-in to the staff one; and
  one support request crossing both panels. They drive the installed Edge
  (`E2E_CHANNEL=chrome` for Chrome), so no browser is downloaded, and reuse
  the API harness's sessions and authenticator secrets (`nextCodeFor`).
