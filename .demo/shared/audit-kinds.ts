/**
 * Audit-entry kinds (Phase 9 Admin §6).
 *
 * The design groups the log into Access · Files · Money · Team · Config.
 * **Files** shipped empty in the Team & Platform phase — nothing wrote a
 * deliverable entry then, and a filter that can only ever return zero rows
 * is a dead control — so its slot was taken by **Work**. The Overview &
 * Work phase added `DeliverableRelease`, so Files is now real and both
 * buckets are kept: releases are Files, and the project, milestone and
 * ticket actions that are not about handing files over stay in Work.
 *
 * The classifier is a prefix match over the dot-namespaced action string,
 * defined once here so the filter query on the server and the chip on the
 * screen cannot disagree about which bucket a row is in.
 */

export const AUDIT_KINDS = ['access', 'team', 'money', 'files', 'work', 'config'] as const

export type AuditKind = typeof AUDIT_KINDS[number]

export interface AuditKindDef {
  key: AuditKind
  label: string
  /** Action prefixes that land in this bucket, longest-match wins. */
  prefixes: string[]
}

export const AUDIT_KIND_DEFS: Record<AuditKind, AuditKindDef> = {
  access: {
    key: 'access',
    label: 'Access',
    prefixes: ['admin.team.suspend', 'admin.team.restore', 'admin.user.update', 'admin.company.remove', 'auth.login.failed'],
  },
  team: {
    key: 'team',
    label: 'Team',
    prefixes: ['admin.team.', 'admin.user.create', 'auth.invite.'],
  },
  money: {
    key: 'money',
    label: 'Money',
    prefixes: [
      'admin.finance.',
      'admin.contract.',
      'admin.credit.',
      'admin.wallet.',
      'admin.withdrawal.',
      'admin.installment.',
      'admin.user.wallet-adjust',
      'contract.',
    ],
  },
  /*
   * Releasing and withdrawing client access to a project's files. Sits
   * *under* `admin.project.` on purpose: the longest-prefix rule in
   * `auditKindOf()` gives these rows to Files, and `kindFilter('work')`
   * excludes them from Work for the same reason, so one row still lands
   * in exactly one bucket.
   */
  files: {
    key: 'files',
    label: 'Files',
    prefixes: ['admin.project.deliverables.'],
  },
  work: {
    key: 'work',
    label: 'Work',
    prefixes: ['admin.project.', 'admin.milestone.', 'admin.ticket.'],
  },
  config: {
    key: 'config',
    label: 'Config',
    prefixes: ['admin.settings.', 'admin.services.', 'admin.notification.'],
  },
}

/**
 * The bucket that absorbs any action no other bucket claims.
 *
 * Every action must land in exactly one filter. Without a designated
 * catch-all, an action added later would render a chip (from the display
 * fallback) while being invisible under every filter — a row you can see
 * in "All" and cannot find by clicking the kind it says it is.
 */
export const FALLBACK_KIND: AuditKind = 'config'

/**
 * Which bucket an action belongs to. Longest matching prefix wins, so
 * `admin.team.suspend` reads as Access (it withdraws access) while the
 * rest of `admin.team.*` reads as Team.
 */
export function auditKindOf(action: string): AuditKind {
  let best: { kind: AuditKind, length: number } | null = null
  for (const def of Object.values(AUDIT_KIND_DEFS)) {
    for (const prefix of def.prefixes) {
      if (action.startsWith(prefix) && (!best || prefix.length > best.length)) {
        best = { kind: def.key, length: prefix.length }
      }
    }
  }
  return best?.kind ?? FALLBACK_KIND
}

/**
 * The prefix filter for one kind, as include/exclude lists.
 *
 * Includes alone would over-select: `admin.team.` belongs to Team but
 * `admin.team.suspend` is Access, so every more specific prefix owned by
 * another kind has to be excluded. Deriving the exclusions from the same
 * table `auditKindOf()` reads keeps the query and the chip in agreement —
 * a row can never be filtered into a bucket its own chip disowns.
 */
export function kindFilter(kind: AuditKind): { matchAll: boolean, include: string[], exclude: string[] } {
  const mine = AUDIT_KIND_DEFS[kind].prefixes
  const others = Object.values(AUDIT_KIND_DEFS)
    .filter(def => def.key !== kind)
    .flatMap(def => def.prefixes)

  if (kind === FALLBACK_KIND) {
    /*
     * The catch-all is expressed as "everything no other bucket claims",
     * which is precisely what `auditKindOf()` does when nothing matches.
     * Selecting on this bucket's own prefixes instead would leave every
     * unclassified action out of all five filters while still showing a
     * Config chip — the buckets have to partition the log.
     */
    return {
      matchAll: true,
      include: [],
      exclude: others.filter(other => !mine.some(m => m.length > other.length && m.startsWith(other))),
    }
  }

  return {
    matchAll: false,
    include: mine,
    // Only prefixes another bucket owns *more specifically* than this one,
    // matching the longest-prefix rule above.
    exclude: others.filter(other => mine.some(m => other.length > m.length && other.startsWith(m))),
  }
}
