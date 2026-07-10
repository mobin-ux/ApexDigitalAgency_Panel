# ADR-010: Honest `TODO(api)` placeholders; never fabricate financial actions

**Status:** Accepted (2026-06/07)

## Context
The redesigns specify data the backend cannot supply yet: a credit-line model,
per-category expense splits, and per-project installment records (the `Installment`
table exists but has no FK to `Project` — `Installment.project` is a string name).
Meanwhile `/api/orders/pay` charges the FULL project amount from the wallet — wiring
it to a button labelled "Pay £250" (one installment) would charge £6,000.

## Decision
- Unbacked figures are computed as **presentation-derived placeholders**, clearly
  marked `// TODO(api): ...` at the derivation site:
  - installment plan = 12-month split of `amount`; `paid` inferred from status
    (completed → all, pending → 0, active → `floor(progress% × 12)`, capped at 11);
    due-in-days derived from `deadline`.
  - credit line: illustrative `£12,500 limit / £3,750 used` (balance.vue).
  - expense split: illustrative Marketing/Development/Design values (balance.vue).
- **Financial buttons never fake or mis-charge**: installment "Pay" buttons toast +
  route to `/dashboards/wallet`; only flows whose semantics match an endpoint call it
  (New Order → POST `/api/orders`).

## Alternatives considered
- Hiding unbacked UI sections: rejected — loses the approved design.
- Wiring `orders/pay` to installment buttons: rejected — amount semantics mismatch.
- Quick schema hack (add FK now): deferred — schema changes deserve their own pass.

## Consequences
- Grep `TODO(api)` to find every backend gap; each is an explicit backlog item:
  installment records linked to projects + charge endpoint, credit-line model,
  expense categorisation.
- Numbers shown for installments are consistent but not contractual data.
