# ADR-004: Self-hosted Yellix as the display face

**Status:** Accepted (2026-06)

## Context
The Apex brand's display/heading face is Yellix (geometric humanist sans). The design
bundle ships 8 `.woff` weights. Body/UI face is Inter (already loaded).

## Decision
Self-host 5 Yellix weights (400/500/600/700/800) in `.demo/app/public/fonts/yellix/`,
declare `@font-face` in `main.css` (`font-display: swap`), and point the theme's
`--font-heading` at `'Yellix', 'Inter', sans-serif`. Usage via the `font-heading`
utility on headings and large numerals only; Inter remains `--font-sans` for body/UI.

## Alternatives considered
- Loading from the `_ds` bundle path: rejected — ties runtime to a design-export
  directory layout.
- Using Yellix everywhere: rejected — the design system itself specifies
  display=Yellix / body=Inter.

## Consequences
- Brand SVGs also live in `/public/brand/` (apex-icon, apex-wordmark-dark) — always use
  the supplied files, never redraw the mark.
- Thin/Light/Black weights were intentionally not shipped (unused) — add if a design
  calls for them.
