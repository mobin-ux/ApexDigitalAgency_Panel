# ADR-019 — Panel v2: the website's plans, priced once, collected at kickoff

**Status:** Accepted (2026-10-24) — introduced by Panel v2
(`Panel Breakpoints.dc.html` and the six pages it frames). Supersedes ADR-011
for **new** orders; plans signed under ADR-011 keep running unchanged.

**Context:** the website (ADR-018) sells seven services on three kinds of
schedule: a deposit then equal monthly payments, a monthly retainer with a
minimum term, and scoped software work. The panel's New Order wizard sold
something else — four services priced as one project figure, financed over 12
months at 0% or 24 months at 1% a month — so a visitor who chose "Website
Design, Starter, £149/mo" on the site arrived at a checkout that could not sell
it. The Panel v2 design makes the panel's checkout the website's plans.

## Decision

1. **One catalogue, shared by both halves of the panel.** `shared/catalog.ts`
   holds the services and plans and `orderTerms()`, the one function that turns
   a service, a plan and "monthly or in full" into the kickoff amount, the
   monthly payment, the number of payments and the total. The wizard renders
   its cards, schedule, summary and footer with it; `POST /api/orders` prices
   the order with it. The same pattern as `shared/permissions.ts` (ADR-016): a
   figure cannot be one thing on screen and another on the contract.
2. **Admin-editable, under a new key.** Setting `catalog.v2` overrides prices
   and copy (`/admin/services`). Service ids, kinds and plan ids are fixed,
   because orders and payment rules are keyed on them. The old
   `catalog.services` row is ignored rather than migrated: it may hold the
   2026-08 shape, and reading it as v2 would price orders from the wrong model.
3. **Nothing is charged at signing.** The order is created `PENDING`
   ("Awaiting kickoff") with `Project.kickoffAmount` — the deposit, the full
   price, set-up plus the first month, or the discovery fee — and a signed v2
   agreement (`AGREEMENT_VERSION_V2`). Staff collect the kickoff amount from
   the wallet after the kickoff call (`collectKickoff()`,
   `POST /api/admin/projects/:id/kickoff`); that one transaction debits the
   wallet, writes the ledger row, starts the project, completes the kickoff
   milestone and gives the plan its real first due date.
4. **Instalment plans start `pending`.** Auto-pay and `chargeInstallment()`
   refuse a pending plan, so no monthly payment can be taken before the
   deposit. The first payment is the 1st of a month at least 14 days after
   kickoff (`firstPaymentDate()`).
5. **Retainers are plans that do not end.** `Installment.kind = 'retainer'`
   runs past its minimum term until cancelled and never draws on the Apex
   credit line. A fixed plan's credit draw is its unpaid instalments: no
   deposit, no interest.
6. **Payments are taken from the wallet.** The mockup offers a saved card as a
   "Pay from" option; nothing in the payment code charges a card for an
   instalment, so the wizard shows the wallet and how to top it up.

## Consequences

- New columns, all additive: `Project.serviceId/planId/planName/payMode/
  kickoffAmount/kickoffPaidAt`, `Installment.kind/depositAmount`,
  `Transaction.projectId`. `prisma db push` on deploy; no backfill —
  `serviceId` null means "an ADR-011 order", and every reader handles both.
- `orderSchedule()` (client) reads either shape, so My orders, Wallet and the
  dashboard show one schedule per order whatever it was signed under.
- An order no longer starts the moment it is signed. The copy says so
  everywhere ("Nothing is charged until kickoff").
- ADR-011's 24-month 1% product is no longer sold. `finance.enable-24mo-plans`
  is now read by nothing new; it stays in `/api/config` for the older pages
  that may cache it.

## Amendment — 2026-10-25: no deposit on fixed plans

`New Order.dc.html` (and the dashboard promo) now sell fixed plans with no
deposit: n equal monthly payments, the first collected at kickoff, or the same
total in one payment. Website Growth is therefore 12 × £299 = £3,588, where it
was £499 + 12 × £299 = £4,087.

- `DEFAULT_CATALOG` carries no deposits. `deposit` stays an optional catalogue
  field: a plan the admin gives one prices the old way, and every label reads
  the terms rather than assuming either.
- `orderTerms()` returns `firstPaymentAtKickoff`. Then `kickoff` is the monthly
  payment and the plan holds all n payments (`payments: n`), so
  `collectKickoff()` records the kickoff as payment 1 on the plan
  (`monthsPaid: 1`, `paid`) in the same transaction. Every counter downstream
  ("1 of 12 paid", credit use, "Installment 2/12") is right without special
  cases.
- The agreement gains a no-deposit schedule paragraph as a new branch, so text
  signed with a deposit still reproduces word for word.
- Orders already placed keep their deposit; `orderSchedule()` reads both.
- The public website (`web/app/data/plans.ts`) still quotes deposits. Until it
  changes, the site and the panel disagree on fixed-plan prices.
