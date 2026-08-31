import prisma from './prisma'
import { getSetting } from './settings'

/**
 * Whether a project's files are in the client's hands (Phase 9 Admin,
 * badges 6 and 28).
 *
 * One function answers it for the admin panel, the customer's project
 * page and the release endpoints, because three copies of this rule is
 * three chances for the panel to say "held" while the customer is
 * downloading — the class of contradiction Phase 2 spent a fix on.
 *
 * The rule, in order:
 *
 * 1. If holding is switched off platform-wide, nothing is withheld.
 *    The setting defaults to **off** so installing this feature cannot
 *    silently revoke files a customer can download today; an owner turns
 *    it on deliberately from Platform settings.
 * 2. If the balance is settled, nothing is withheld — the hold is a
 *    payment gate, not a permanent lock (badge 28: "a default, not a
 *    lock").
 * 3. Otherwise the files are held until a member of staff releases them,
 *    which is recorded with their name, their role and their reason.
 */

/** Setting key: platform-wide "hold deliverables until the balance is paid". */
export const HOLD_UNTIL_PAID_KEY = 'deliverables.hold-until-paid'

/** Off by default — see rule 1 above. */
export const HOLD_UNTIL_PAID_DEFAULT = false

/** The subset of a project this module needs; anything with these fields fits. */
export interface DeliverableProjectInput {
  id: string
  status: string
  amount: number
  installmentPlan?: { total: number, paid: number } | null
}

export interface DeliverableState {
  /** True when the client can see the file list but not download it. */
  held: boolean
  /** True when a member of staff has released the files and not withdrawn them. */
  released: boolean
  /** The active release, when there is one. */
  releaseId: string | null
  releasedAt: Date | null
  releasedBy: string | null
  /** Still owed on this project, in pounds. */
  outstanding: number
  /** Platform-wide setting, so the UI can explain a project that is not held. */
  holdEnabled: boolean
}

/**
 * What the project still owes.
 *
 * A financed project's truth is its plan. A project with no plan is
 * either paid in full (`/api/orders/pay` charges the whole amount and
 * moves it out of PENDING) or has not been paid at all, which is exactly
 * what PENDING means — so the fallback reads the status rather than
 * inventing a partial figure from a ledger that is not grouped by
 * project.
 */
export function outstandingFor(project: DeliverableProjectInput): number {
  if (project.installmentPlan) {
    return Math.max(0, project.installmentPlan.total - project.installmentPlan.paid)
  }
  return project.status === 'PENDING' ? Math.max(0, project.amount) : 0
}

/** The newest release for a project that has not been withdrawn. */
export async function activeRelease(projectId: string) {
  return prisma.deliverableRelease.findFirst({
    where: { projectId, withdrawnAt: null },
    orderBy: { releasedAt: 'desc' },
  })
}

/** Is the platform-wide payment gate switched on? */
export function holdEnabled(): Promise<boolean> {
  return getSetting<boolean>(HOLD_UNTIL_PAID_KEY, HOLD_UNTIL_PAID_DEFAULT)
}

/** Full state for one project (two queries: the setting and the release). */
export async function deliverableState(project: DeliverableProjectInput): Promise<DeliverableState> {
  const [enabled, release] = await Promise.all([holdEnabled(), activeRelease(project.id)])
  return buildState(project, enabled, release)
}

/**
 * State for several projects at once — one setting read and one release
 * query for the whole set, so a list endpoint does not run 2N queries.
 */
export async function deliverableStates(
  projects: DeliverableProjectInput[],
): Promise<Map<string, DeliverableState>> {
  const ids = projects.map(p => p.id)
  const [enabled, releases] = await Promise.all([
    holdEnabled(),
    ids.length
      ? prisma.deliverableRelease.findMany({
          where: { projectId: { in: ids }, withdrawnAt: null },
          orderBy: { releasedAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  // Newest first, so the first row seen for a project is the active one.
  const byProject = new Map<string, (typeof releases)[number]>()
  for (const release of releases) {
    if (!byProject.has(release.projectId)) {
      byProject.set(release.projectId, release)
    }
  }

  return new Map(projects.map(p => [p.id, buildState(p, enabled, byProject.get(p.id) ?? null)]))
}

function buildState(
  project: DeliverableProjectInput,
  enabled: boolean,
  release: { id: string, releasedAt: Date, actorEmail: string | null } | null,
): DeliverableState {
  const outstanding = outstandingFor(project)
  return {
    // Half a penny of tolerance: these are floats, and a plan that has
    // been paid off can land a rounding error away from zero.
    held: enabled && outstanding > 0.005 && !release,
    released: Boolean(release),
    releaseId: release?.id ?? null,
    releasedAt: release?.releasedAt ?? null,
    releasedBy: release?.actorEmail ?? null,
    outstanding,
    holdEnabled: enabled,
  }
}
