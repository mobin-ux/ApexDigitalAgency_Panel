# ADR-017 — Deliverable release: one gate, enforced on the server, off by default

**Status:** Accepted (2026-09-01) — introduced by V2 Phase 9 Admin
(`Admin - Overview & Work.dc.html`, badges 6–7 and 28).
**Context:** the design's highest-consequence admin action is releasing a
project's files to the client. Nothing in the codebase could withhold a
file: `ProjectFile` rows were returned to the customer with their URLs
unconditionally, so "hold deliverables until fully paid" — a platform
rule the Phase 9 settings screen was asked to expose — had nothing to
govern, and the Team & Platform phase shipped it as a "Not built"
statement rather than a boolean nothing read.

## 1. The rule lives in one function

`server/utils/deliverables.ts` answers "are this project's files in the
client's hands", and three callers read it: the admin project detail, the
admin Overview queue, and **`/api/orders`**, which is the customer's own
project page. Three copies of this rule would be three chances for the
panel to say "held" while the customer is downloading.

The rule, in order:

1. If `deliverables.hold-until-paid` is off platform-wide, nothing is
   withheld.
2. If the balance is settled, nothing is withheld — it is a payment gate,
   not a permanent lock (badge 28: "a default, not a lock").
3. Otherwise the files are held until a member of staff releases them.

"What is still owed" comes from the project's `Installment` plan when it
has one. A project with no plan is either paid in full — `/api/orders/pay`
charges the whole amount and moves it out of `PENDING` — or has not been
paid at all, which is what `PENDING` means. The fallback reads the status
rather than inventing a partial figure from a ledger that is not grouped
by project.

## 2. The gate is enforced on the server, not in the template

When files are held, `/api/orders` returns the file **names and sizes**
and blanks the `url`. Both halves of that matter:

- Hiding the link in the template alone would leave the address in the
  page payload, which is not a gate — the reader can open dev tools.
- Returning nothing at all would leave the customer unable to see that
  the work exists. Knowing what is waiting is the point; the customer's
  own page says the files are ready and what unlocks them.

The customer's rows are rendered as plain elements rather than anchors
with a stripped `href`, because a link that goes nowhere reads as a
download that failed.

## 3. Off by default, deliberately

`deliverables.hold-until-paid` defaults to **false**. Enabling it
retrospectively withholds files that customers can download today, and
that is a commercial decision for an owner to take deliberately from
Platform settings rather than one a deployment makes on their behalf.

The consequence is that the design's default screen state — an amber
"Deliverables held" panel — is not what a fresh install shows. The panel
has four states and names the one it is in, including *why* nothing is
being withheld ("holding is off platform-wide" versus "the balance is
settled"), because a single boolean would have collapsed those into one
screen that explains neither.

## 4. Early release is allowed, and recorded

The button is never quietly disabled. Where a balance is outstanding the
panel states exactly what has been paid, the dialog restates it, and a
typed reason is **required** — enforced in the endpoint, not only in the
dialog. Where nothing is owed the hand-over is routine and no reason is
asked for; requiring one everywhere trains people to type "n/a".

`DeliverableRelease` snapshots the outstanding balance at the moment of
release. Reading it back from the plan later would answer what is owed
*now*, not what was owed when somebody decided.

Withdrawal stamps `withdrawnAt` on the active row rather than deleting
it: the point of recording who released files early is that the record
survives the decision being reversed. A re-release writes a new row, so
the sequence of decisions is intact.

## 5. Nothing is emailed

The mockup promises the client is emailed a download link. There is no
mail provider in this stack, so the copy says what actually happens: the
files become downloadable on their project page immediately. This is the
same resolution ADR-016 reached for staff invites.

## 6. Consequences

- The audit log's **Files** bucket is real. The Team & Platform phase
  gave that slot to Work because deliverable release wrote no entry and a
  filter that can only return zero rows is a dead control; both buckets
  now exist, and `admin.project.deliverables.` is owned by Files under the
  longest-prefix rule that keeps the buckets a partition.
- Releasing is gated on `work.release` — Owner, Admin and Project
  manager — which is the row the design's table already specified.
- `ProjectNote` is a separate model rather than a flag on
  `TicketMessage`. Client-visible text and internal text are kept apart
  at the storage level, so no code path can put a staff note in front of
  a customer (badge 8).
- There is still no upload endpoint. Files reach `ProjectFile` by seed or
  direct record, so the release flow governs deliverables the agency has
  put there by other means. An uploader is the next thing this feature
  needs, not a precondition for the gate being real.
