import type { StaffRole } from '~~/shared/permissions'

/**
 * One tone per staff role, defined once (Phase 9 Admin).
 *
 * The team table, the invite dialog, the role picker and the audit log
 * all colour a role from here, so the same role cannot be amber in one
 * place and violet in another. The values reuse the shared status
 * accents rather than adding six new hues (CLAUDE.md rule 1): owner is
 * amber because it is the role carrying a standing warning, and
 * read-only takes the muted surface because it is the absence of
 * privilege rather than a kind of it.
 */
export const ROLE_CHIP: Record<StaffRole, string> = {
  owner: 'bg-[#D9A521]/16 text-[#F2C14E]',
  admin: 'bg-primary-500/14 text-primary-400',
  pm: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
  support: 'bg-[#22B07D]/14 text-[#22B07D]',
  finance: 'bg-primary-500/10 text-primary-600 dark:text-primary-200',
  readonly: 'bg-muted-200 text-muted-600 dark:bg-white/5 dark:text-muted-400',
}

/** Solid dot of the same hue, for the role pickers. */
export const ROLE_DOT: Record<StaffRole, string> = {
  owner: 'bg-[#F2C14E]',
  admin: 'bg-primary-400',
  pm: 'bg-[#6EA8FE]',
  support: 'bg-[#22B07D]',
  finance: 'bg-primary-300',
  readonly: 'bg-muted-400',
}
