# ADR-011: Financing math (0% / 12-mo and 1%·24-mo)

**Status:** Accepted (2026-06) — locked by the approved New Order design

## Context
The 0% Finance offer is Apex Digi's core differentiator. The Claude Design New Order
spec ships exact math in its logic script; the implementation must match it and every
surface (wizard, contract copy, order summary, My Orders payment plan) must agree.

## Decision
For a plan with base price `base` (GBP):

- **12 monthly payments — 0% interest**
  `monthly = base / 12` · `total = base` · `interest = 0`
- **24 monthly payments — 1% per month on the reducing balance** (standard
  amortization, r = 0.01, n = 24):
  `monthly = base · r / (1 − (1 + r)^-24)` · `total = monthly × 24` ·
  `interest = total − base`
- Display: whole pounds, en-GB grouping (`£226`), `tabular-nums`.
- Contract terms (rendered in the agreement): £0 due today, no down payment, first
  instalment 30 days after project start, no early-repayment fees, cancel free before
  work begins.
- Plan catalogue (single source: `services.vue`): web 2400/4800★/9600 · mkt
  1800/3600★/7200 · uiux 2400/4800★/8400 · brand 1800/3600★/7200 (★ = MOST POPULAR;
  plan cards advertise the 24-mo monthly as "from £X/mo").

Reference check: base £4,800 → 12-mo £400/mo (£4,800 total) · 24-mo £226/mo
(£5,423 total, £623 interest).

## Alternatives considered
- Flat 12%/yr simple interest: rejected — the design's script uses amortization.

## Consequences
- Any pricing change edits the catalogue in `services.vue` only.
- When installments become real backend records (ADR-010), generation must use this
  same formula or reconcile explicitly.
