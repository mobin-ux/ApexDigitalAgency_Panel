import prisma from './prisma'

const ACTIVE = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW']

export interface ProjectManager {
  id: string
  name: string
  orderId: string
  orderName: string
}

/**
 * The person Support introduces as "Your project manager": the manager of
 * the customer's newest active order that has one. There is no per-client
 * account manager in this app, so this is the nearest true answer; null when
 * nobody is assigned yet, and the page then leaves the card out.
 */
export async function projectManagerFor(userId: string): Promise<ProjectManager | null> {
  const p = await prisma.project.findFirst({
    where: { userId, status: { in: ACTIVE }, managerId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, manager: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!p?.manager) {
    return null
  }
  const name = [p.manager.firstName, p.manager.lastName].filter(Boolean).join(' ').trim() || 'Your project manager'
  return { id: p.manager.id, name, orderId: p.id, orderName: p.name }
}

/** "Alex Kerr" from a staff row; empty when the row has no name. */
export function staffName(u: { firstName: string | null, lastName: string | null } | null | undefined): string {
  return u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() : ''
}
