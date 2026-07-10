# ADR-009: `postinstall: prisma generate`

**Status:** Accepted (2026-06)

## Context
After a fresh `pnpm install`, every API route crashed with
`Named export 'PrismaClient' not found … is a CommonJS module` — the Prisma client
had never been generated, and nothing in the install pipeline generated it.

## Decision
Root `package.json`: `"postinstall": "prisma generate"`.

## Alternatives considered
- Documenting a manual step: rejected — guaranteed to be forgotten (it already was).
- Generating in `dev` script: rejected — build/CI paths need it too.

## Consequences
- Fresh clones work. If the error ever reappears (e.g. `--ignore-scripts` installs),
  run `pnpm exec prisma generate` and restart the dev server (the running server
  caches the broken module until restarted).
