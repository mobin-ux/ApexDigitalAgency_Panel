# ADR-006: Claude Design zips are the canonical design source

**Status:** Accepted (2026-06, reconfirmed 2026-07)

## Context
The user redesigns each dashboard page in Claude Design and delivers a zip export
containing: the page spec (`Apex <Page>.dc.html` — inline-styled HTML + a React-ish
logic script with the exact data model, pricing math, and interaction states), an
identical `_ds/apex-design-system-*/` bundle, brand assets, and reference screenshots.
A `claude_design` MCP (DesignSync) is also connected.

## Decision
Implement from the **zip** (local, complete, reliable): read the `.dc.html` fully —
markup AND logic script — then reproduce it as a production Vue SFC:
- structure/spacing/typography copied faithfully (keep arbitrary px values),
- inline hex → tokens (ADR-002), `$` → `£` (ADR-005), Lucide icons via `<Icon>`,
- the mock's React state logic re-expressed as Vue composition state,
- mock data replaced with real API data; gaps flagged `TODO(api)` (ADR-010),
- dead-end links in the mock rewired to real routes (e.g. support stub → real
  `/dashboards/support`).
Zips live in `C:\Users\mobin\Downloads\` — re-extract from there, not from stale
scratchpad dirs (scratchpads are per-session).

## Alternatives considered
- Import via DesignSync MCP: kept as fallback; zips arrived with every request and
  contain the identical payload.
- Screenshot-only implementation: rejected — the logic script IS the spec for math
  and states; ignoring it loses exactness.

## Consequences
- Per-page cadence: extract → map sections/headings → read logic script → implement →
  lint → verify → document → commit → push.
- The `_ds` bundle needs integrating only once (done); later zips' bundles are ignored.
