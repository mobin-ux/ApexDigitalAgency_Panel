# ADR-012: Page-per-commit, direct-to-master workflow

**Status:** Accepted (2026-06/07)

## Context
Solo-developer repo (`github.com/mobin-ux/ApexDigitalAgency_Panel`), no CI/workflows,
no branch protection. Work began on branch `refactor/apex-dashboard`; the user then
asked for everything on GitHub and approved a fast-forward of `master`.

## Decision
- Work lands directly on `master`; push after each page/feature commit
  (user-approved standing policy).
- One commit per page/feature with a conventional-commit subject and a detailed body:
  what changed, why, data/integration notes, verification evidence.
- Commit trailer: `Co-Authored-By:` the current Claude model (historic commits carry
  `Claude Opus 4.8`; from 2026-07 sessions this is `Claude Fable 5
  <noreply@anthropic.com>`).
- Never commit `prisma/dev.db` (local seed/test data churn) or `graphify-out/`
  (generated artifacts).
- Cadence per page: implement → `eslint --fix` → verify in preview → update
  DESIGN_SYSTEM.md roadmap → commit → push.

## Alternatives considered
- PR-per-page: rejected by usage — no reviewers, no CI gate; direct push approved.

## Consequences
- `refactor/apex-dashboard` (local + origin) is stale; master supersedes it. Safe to
  delete, but do not delete without explicit user confirmation.
- If CI or collaborators arrive, revisit this ADR.
