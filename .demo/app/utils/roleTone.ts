import type { StaffRole } from '~~/shared/permissions'

/**
 * One tone per staff role, defined once (Phase 9 Admin).
 *
 * The team table, the invite dialog, the role picker and the audit log
 * all colour a role from here, so the same role cannot be amber in one
 * place and violet in another. The values reuse the shared status
 * accents rather than adding new hues (CLAUDE.md rule 1): owner is
 * amber because it is the role carrying a standing warning, and
 * read-only takes the muted surface because it is the absence of
 * privilege rather than a kind of it. The two website roles (ADR-021)
 * share the completed-blue with PM at lighter tints: they are the content
 * side of the same "does the work" family.
 */
export const ROLE_CHIP: Record<StaffRole, string> = {
  // Status tokens, so each chip reads in both themes: amber and coral are
  // ink text on light (they fail AA as text on white) and bright on dark.
  owner: 'bg-st-warning-bg text-st-warning-fg',
  admin: 'bg-st-violet-bg text-st-violet-fg',
  pm: 'bg-st-info-bg text-st-info-fg',
  support: 'bg-st-success-bg text-st-success-fg',
  finance: 'bg-st-violet-bg text-st-violet-fg',
  publisher: 'bg-st-info-bg text-st-info-fg',
  editor: 'bg-st-info-bg text-st-info-fg',
  readonly: 'bg-st-neutral-bg text-st-neutral-fg',
}

/** Solid dot of the same hue, for the role pickers. */
export const ROLE_DOT: Record<StaffRole, string> = {
  owner: 'bg-[#F2C14E]',
  admin: 'bg-primary-400',
  pm: 'bg-[#6EA8FE]',
  support: 'bg-[#22B07D]',
  finance: 'bg-primary-300',
  publisher: 'bg-[#6EA8FE]',
  editor: 'bg-[#6EA8FE]/70',
  readonly: 'bg-muted-400',
}
