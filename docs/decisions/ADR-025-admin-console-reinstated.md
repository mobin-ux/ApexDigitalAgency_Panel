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
