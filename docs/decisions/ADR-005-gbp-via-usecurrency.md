# ADR-005: All money is GBP through `useCurrency()`

**Status:** Accepted (2026-06)

## Context
Apex Digi is a UK (London) agency; the live site prices in £. Early custom pages and
ALL Claude Design mocks format money as `$`/USD. Scattered `Intl.NumberFormat` calls
had already drifted (USD here, none there).

## Decision
One composable — `.demo/app/composables/useCurrency.ts` — is the only money formatter:
`formatCurrency(n)` → en-GB GBP, 0 decimals by default (`£1,499`), `formatNumber`,
`currencySymbol`. Every implemented page imports it. **When implementing design mocks,
`$` amounts are intentionally rendered as `£`** — this divergence from the mock is
correct, not a fidelity bug.

## Alternatives considered
- Match the mocks' `$`: rejected — brand reality wins over mock fidelity.
- i18n-driven multi-currency: rejected for now — single-market product.

## Consequences
- Server APIs return raw numbers; formatting is a UI concern
  (see `/api/dashboard/stats` rewrite).
- Rounding: whole pounds by default; pass fraction-digit options when pennies matter.
