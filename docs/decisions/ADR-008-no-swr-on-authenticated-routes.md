# ADR-008: Never SWR-cache authenticated routes

**Status:** Accepted (2026-06) — security-relevant

## Context
The template ships `routeRules` with `swr: 3600` on many route groups, including
`/dashboards/**`. Nitro's SWR caches the **first rendered HTML** and serves it to all
subsequent visitors for the TTL. For authenticated, per-user pages that meant:
1. the first (unauthenticated) render — the login redirect — was cached and served to
   logged-in users (the observed "reload logs me out" bug), and
2. conversely a logged-in user's rendered content could be cached and served to
   someone else — a data-leak class of bug.

## Decision
`.demo/nuxt.config.ts` routeRules: `'/dashboards/**': { swr: false }` with an inline
comment explaining why. Template marketing/demo routes keep their swr.

## Alternatives considered
- Cache with per-cookie keys: rejected — complexity, no need; these pages are cheap.
- Remove routeRules entirely: rejected — public routes benefit from swr.

## Consequences
- Any NEW authenticated route group must also be excluded from swr.
- This plus ADR-007 fixed reload-logout; if the symptom reappears, check BOTH.
