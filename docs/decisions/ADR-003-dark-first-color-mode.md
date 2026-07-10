# ADR-003: Dark-first color mode

**Status:** Accepted (2026-06)

## Context
The user chose to keep the dark navy aesthetic as the brand default for the dashboard
(the marketing site is light). The template previously followed OS preference, and the
custom pages were hard-locked to dark via hex.

## Decision
`.demo/nuxt.config.ts`:
```ts
colorMode: { preference: 'dark', fallback: 'dark', classSuffix: '' }
```
`classSuffix: ''` keeps the toggled class as `.dark`, matching `main.css` overrides.
The toolbar `BaseThemeToggle` remains functional — pages must not break in light mode.

## Alternatives considered
- Follow OS preference: rejected — brand direction is dark.
- Remove the light theme: rejected — cheap to keep via tokens; Apex DS defines both.

## Consequences
- New pages are designed dark-first; token usage keeps light mode acceptable.
- The Apex design exports are dark-surface (`.apex-dark` scope) — they map 1:1.
