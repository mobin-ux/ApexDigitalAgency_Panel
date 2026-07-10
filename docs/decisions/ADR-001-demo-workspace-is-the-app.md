# ADR-001: The `.demo` workspace is the real application

**Status:** Accepted (2026-06)

## Context
The Tairo template monorepo ships two app workspaces: `.app` (starter shell) and
`.demo` (full showcase). The customer dashboard was built by customizing `.demo`;
`.app` contains only an `app.vue` and assets. The root `package.json`'s default
`dev` script (`pnpm --filter=app dev`) misleadingly points at the empty `.app`.

## Decision
Treat `.demo` as the product. All pages, composables, server routes, and config work
happens under `.demo/`. Run with `pnpm demo:dev`.

## Alternatives considered
- Migrate customer pages into `.app` for a clean tree: rejected — high churn, no user
  benefit now; the demo workspace carries the working i18n/module config.

## Consequences
- Anyone running bare `pnpm dev` gets the empty shell — documented in CLAUDE.md.
- Template demo pages (`/layouts/**`, `/starters/**`, most `/dashboards/*`) coexist
  with customer pages; leave them alone unless asked (they are reference material for
  canonical component usage).
