# ADR-002: Fold the Apex design system into central Tailwind tokens

**Status:** Accepted (2026-06) — supersedes the interim indigo/slate palette

## Context
The client's Apex design system (Claude Design export) ships its own CSS token files
(`_ds/.../tokens/*.css` with `--apex-*` variables). The dashboard already had a token
system: Tailwind v4 `@theme` ramps (`primary`, `muted`) consumed by Shuriken UI.
Earlier custom pages had bypassed tokens entirely with hardcoded hex (`bg-[#0f111a]`),
which is what made the UI inconsistent and dark-locked in the first place.

## Decision
Define the brand ONCE in `.demo/app/assets/main.css` `@theme`:
- `--color-primary-*` = electric-violet ramp (500 `#7d53f2`, 600 hover `#6c40e8`,
  400 `#9b79f6`, 200 `#c9b8fb`, 50 `#f1ecfe`).
- `--color-muted-*` = warm-gray→navy-ink ramp (50 `#f7f8f9` … 700 `#1e2f35`,
  800 card `#16252a`, 900 `#0c1719`, 950 page `#0b1517`).
Pages use token utilities; fixed status accents (`#22B07D`, `#F2C14E`/`#D9A521`,
`#EC6453`, `#6EA8FE`) stay literal by convention.

## Alternatives considered
- Import the `_ds` CSS alongside Tailwind: rejected — two competing token systems,
  Shuriken components wouldn't pick up the brand, drift guaranteed.
- Keep hardcoding hex per page: rejected — the root cause of the original
  inconsistency; breaks theming.

## Consequences
- Re-theming the whole app = editing two ramps in one file.
- Shuriken `<Base*>` components automatically render on-brand.
- Design-export hex values must be translated to tokens during implementation
  (e.g. `#16252A` → `bg-muted-800`).
