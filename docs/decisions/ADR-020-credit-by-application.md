# ADR-020 — Credit lines are applied for and approved by staff

**Status:** Accepted (2026-10-25). Chosen by the owner when `Wallet.dc.html`
was implemented ("Applications").

## Context

Until now every account got an Apex credit line automatically:
`ensureCredit()` created or normalised a line at the ceiling (Setting
`credit.max-limit`, default £20,000) on every page load. The Wallet design
replaces that with an application: business details, the applicant, photo ID,
three months of banking and a requested limit, followed by an "Under review"
screen and a decision. The admin "Clients & Money" design has the matching
"Credit lines" screen where staff approve and set limits.

## Decision

- **`CreditApplication`** holds each application: SUBMITTED, then APPROVED,
  DECLINED or WITHDRAWN. Photo ID and statements are `Attachment` rows linked
  to it (`creditApplicationId`).
- **Only an approved application creates a line.** `ensureCredit()` now reads
  the line and recomputes `used`; it never creates one or rewrites its limit.
  It returns a `state`: none, review, approved, frozen.
- **The ceiling is the approval maximum.** `credit.max-limit` caps what staff
  may approve and the top of the customer's request slider. Approved lines
  keep their own limit if the ceiling later changes.
- **Without a line, one fixed monthly plan at a time** (`creditAllows()`):
  with nothing yet owed, any one plan may be signed; after that a line's
  available amount decides. Retainers never draw credit, as before.
- **Existing lines were kept.** Customers given a line automatically keep it
  as an approved line; nobody loses credit they had.
- **Staff decide in `/admin/credit`.** `money.view` can see the queue;
  `credit.approve` (Owner, Admin) can approve with a limit or decline, with an
  internal note that goes to the audit log only.
- **Documents are private and short-lived where possible.** Only the
  applicant and `credit.approve` staff can download them (a project manager
  with `work.view` gets 404). Withdrawing deletes them from disk at once, and a
  replaced or removed file is deleted before sending (`DELETE /api/uploads/:id`).

## Not built (real or absent)

- **Open Banking ("Connect your bank").** No provider is set up, so statements
  are uploaded, the design's other option.
- **Postcode address lookup.** The home address is typed.
- **Fraud-prevention-agency checks.** The consent and footnote say what staff
  actually check: Companies House, the ID and the statements.
- **Email.** There is no mail provider; decisions arrive as notifications and
  on the Wallet, and the copy says so.
- Company search uses Companies House when `NUXT_COMPANIES_HOUSE_KEY` is set;
  without it the name and number are typed and staff check them.

## Consequences

- New customers start at "Not set up" and can run one monthly plan before
  applying.
- Staff must work the queue: an unanswered application blocks a customer's
  second plan. The design promises a decision within one working day.
- The documents are personal data. Retention after a decision is not yet
  defined: approved and declined applications keep their files. A retention
  rule (and deletion job) is open.
- Lending to sole traders and partnerships can fall under consumer credit
  rules. The plans carry no interest, but the legal position should be
  confirmed before this goes live.
