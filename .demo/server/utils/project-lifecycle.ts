import type { Db } from './mail/outbox'

/**
 * What a project's state means for everything hanging off it, so the admin
 * console and the client panel read one answer (ADR-025, phase 4).
 */

/** A plan whose project was cancelled: it takes no more payments. */
export const PLAN_CANCELLED = 'cancelled'

export interface CancelOutcome {
  planStopped: boolean
  contractCancelled: boolean
}

/**
 * End a project: the project is CANCELLED, its unsettled instalment plan
 * stops (auto-pay, the client's Pay button and the admin charge all refuse
 * it, and it no longer counts against the credit line), and its live
 * contract is CANCELLED. Money already taken is not touched here; a refund
 * is its own audited action. Run it inside the caller's transaction.
 */
export async function cancelProject(tx: Db, projectId: string): Promise<CancelOutcome> {
  await tx.project.update({ where: { id: projectId }, data: { status: 'CANCELLED' } })
  const plan = await tx.installment.updateMany({
    where: { projectId, status: { notIn: ['settled', PLAN_CANCELLED] } },
    data: { status: PLAN_CANCELLED, amountDue: 0 },
  })
  const contract = await tx.contract.updateMany({
    where: { projectId, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
    data: { status: 'CANCELLED' },
  })
  return { planStopped: plan.count > 0, contractCancelled: contract.count > 0 }
}

/**
 * Progress follows the timeline: the share of milestones done. Called after
 * staff edit a milestone, so the bar the client sees cannot disagree with
 * the stages beneath it. A project with no milestones keeps its figure.
 */
export async function syncProgress(tx: Db, projectId: string): Promise<number | null> {
  const milestones = await tx.milestone.findMany({ where: { projectId }, select: { status: true } })
  if (milestones.length === 0) {
    return null
  }
  const progress = Math.round((milestones.filter(m => m.status === 'COMPLETED').length / milestones.length) * 100)
  await tx.project.update({ where: { id: projectId }, data: { progress } })
  return progress
}
