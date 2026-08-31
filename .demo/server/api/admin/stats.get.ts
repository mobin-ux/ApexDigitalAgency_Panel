import { defineEventHandler } from 'h3'
import { can } from '../../../shared/permissions'
import { deliverableStates, holdEnabled } from '../../utils/deliverables'
import { requireStaffPermission } from '../../utils/permissions'
import prisma from '../../utils/prisma'

/**
 * GET /api/admin/stats — what the admin Overview screen is built from.
 *
 * Phase 9 (Overview & work) turned this from a set of headline numbers
 * into a work queue, and the rules it follows are badges 1–3:
 *
 * - **Every figure is a count of records someone can click through to.**
 *   No revenue tile without a period, no "+12% vs last month" where no
 *   comparison is stored. `totalRevenue` and `revenue30d` survive from
 *   the previous version because they are real sums over a stated range,
 *   but nothing on the new screen renders a growth rate.
 * - **The queue is the home screen** (`needs`): one list, oldest first,
 *   each row naming the record, who owns it and how long it has waited.
 * - **Money is omitted, not blanked, for roles without it.** The panel
 *   asks `money.view` and simply does not send the figures otherwise, so
 *   a Project manager's browser never receives numbers the UI then has
 *   to remember to hide.
 *
 * Every pre-existing field is still returned, so the shape only grew.
 */

const DAY = 24 * 60 * 60 * 1000

/** Human wait time for a queue row: "3 days", "2 hours", "just now". */
function waitedFor(since: Date): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60_000))
  if (mins < 60) {
    return mins <= 1 ? 'just now' : `${mins} mins`
  }
  const hours = Math.round(mins / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

function fullName(user: { firstName?: string | null, lastName?: string | null, email?: string | null } | null): string | null {
  if (!user) {
    return null
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email || null
}

export default defineEventHandler(async (event) => {
  const session = await requireStaffPermission(event, 'work.view')
  const canMoney = can(session.staffRole, 'money.view')

  const now = new Date()
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY)
  const inThirtyDays = new Date(Date.now() + 30 * DAY)

  const [totalCustomers, newCustomers30d, suspendedUsers, totalProjects, activeProjects, pendingProjects, completedProjects, cancelledProjects, openTickets, unassignedTickets, revenue, revenue30d, pendingWithdrawals, recentAudit] = await prisma.$transaction([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.project.count({ where: { status: 'PENDING' } }),
    prisma.project.count({ where: { status: 'COMPLETED' } }),
    prisma.project.count({ where: { status: 'CANCELLED' } }),
    prisma.ticket.count({ where: { status: 'OPEN' } }),
    prisma.ticket.count({ where: { assigneeId: null, status: { in: ['OPEN', 'PENDING'] } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT' } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.withdrawalRequest.count({ where: { status: 'Processing' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ])

  /* ---------------------------------------------- the waiting queue --- */

  // Finished work whose files are still withheld from the client.
  const finished = await prisma.project.findMany({
    where: { status: 'COMPLETED', files: { some: {} } },
    select: {
      id: true,
      name: true,
      status: true,
      amount: true,
      category: true,
      updatedAt: true,
      installmentPlan: { select: { total: true, paid: true } },
      manager: { select: { firstName: true, lastName: true, email: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { files: true } },
      /*
       * The wait is measured from the newest file, not from `updatedAt`:
       * "these deliverables have sat unreleased for three days" is a fact
       * about the files, and `updatedAt` moves every time anyone edits
       * the project — renaming it would reset the clock and drop the row
       * out of an oldest-first queue.
       */
      files: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  const [states, holdingOn] = await Promise.all([deliverableStates(finished), holdEnabled()])
  const awaitingRelease = finished.filter(p => states.get(p.id)?.held)

  // Live work with nobody's name on it — the usual reason it has stalled.
  const unassigned = await prisma.project.findMany({
    where: { managerId: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    select: { id: true, name: true, category: true, createdAt: true, user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  // Requests nobody has answered yet.
  const staleTickets = await prisma.ticket.findMany({
    where: { status: { in: ['OPEN', 'PENDING'] } },
    select: {
      id: true,
      subject: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      assignee: { select: { firstName: true, lastName: true, email: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
      messages: { select: { isAdmin: true }, take: 200 },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })
  const awaitingFirstReply = staleTickets.filter(t => !t.messages.some(m => m.isAdmin))

  const overdueInstallments = canMoney
    ? await prisma.installment.findMany({
        where: { nextDue: { lt: now }, status: { not: 'settled' } },
        select: {
          id: true,
          project: true,
          projectId: true,
          amountDue: true,
          nextDue: true,
          monthsPaid: true,
          monthsTotal: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { nextDue: 'asc' },
        take: 20,
      })
    : []

  interface QueueRow {
    kind: 'release' | 'unassigned' | 'money' | 'support'
    title: string
    sub: string
    owner: string | null
    since: string
    waited: string
    to: string
  }

  const needs: QueueRow[] = [
    ...awaitingRelease.map((p): QueueRow => ({
      kind: 'release',
      title: `${p.name} — finished, files not released`,
      sub: `${p.category} · ${p._count.files} file${p._count.files === 1 ? '' : 's'} for ${fullName(p.user) ?? 'the client'}`,
      owner: fullName(p.manager),
      since: (p.files[0]?.createdAt ?? p.updatedAt).toISOString(),
      waited: waitedFor(p.files[0]?.createdAt ?? p.updatedAt),
      to: `/admin/projects/${p.id}`,
    })),
    ...unassigned.map((p): QueueRow => ({
      kind: 'unassigned',
      title: `${p.name} — nobody assigned`,
      sub: `${p.category} · ordered by ${fullName(p.user) ?? 'a client'}`,
      owner: null,
      since: p.createdAt.toISOString(),
      waited: waitedFor(p.createdAt),
      to: `/admin/projects/${p.id}`,
    })),
    ...overdueInstallments.map((i): QueueRow => ({
      kind: 'money',
      title: `${fullName(i.user) ?? 'A client'} — instalment ${Math.min(i.monthsPaid + 1, i.monthsTotal)} overdue`,
      sub: `${i.project} · due ${i.nextDue.toISOString().slice(0, 10)}`,
      owner: null,
      since: i.nextDue.toISOString(),
      waited: waitedFor(i.nextDue),
      to: '/admin/payments?tab=installments',
    })),
    ...awaitingFirstReply.map((t): QueueRow => ({
      kind: 'support',
      title: t.subject,
      sub: `Support · ${t.category} · awaiting a first reply`,
      owner: fullName(t.assignee),
      since: t.createdAt.toISOString(),
      waited: waitedFor(t.createdAt),
      to: `/admin/tickets?ticket=${t.id}`,
    })),
  ].sort((a, b) => a.since.localeCompare(b.since))

  /* ------------------------------------------------------ money card --- */

  const money = canMoney
    ? await (async () => {
        const [creditUsed, dueSoon, overdue] = await prisma.$transaction([
          prisma.creditLine.aggregate({ _sum: { used: true }, where: { status: 'ACTIVE' } }),
          prisma.installment.aggregate({
            _sum: { amountDue: true },
            where: { nextDue: { gte: now, lte: inThirtyDays }, status: { not: 'settled' } },
          }),
          prisma.installment.aggregate({
            _sum: { amountDue: true },
            where: { nextDue: { lt: now }, status: { not: 'settled' } },
          }),
        ])
        return {
          creditInUse: creditUsed._sum.used ?? 0,
          dueNext30Days: dueSoon._sum.amountDue ?? 0,
          overdue: overdue._sum.amountDue ?? 0,
        }
      })()
    : null

  return {
    // --- pre-existing fields, unchanged ---
    totalCustomers,
    newCustomers30d,
    suspendedUsers,
    totalProjects,
    activeProjects,
    pendingProjects,
    openTickets,
    unassignedTickets,
    totalRevenue: revenue._sum.amount ?? 0,
    revenue30d: revenue30d._sum.amount ?? 0,
    pendingWithdrawals,
    recentAudit,

    // --- Phase 9: the Overview screen ---
    awaitingRelease: awaitingRelease.length,
    // Whether the platform-wide payment gate is on at all, so the tile can
    // say why nothing is awaiting release rather than showing a bare zero.
    holdEnabled: holdingOn,
    ticketsAwaitingFirstReply: awaitingFirstReply.length,
    overdueInstallmentCount: overdueInstallments.length,
    pipeline: [
      { key: 'PENDING', label: 'Awaiting kickoff', count: pendingProjects },
      { key: 'IN_PROGRESS', label: 'In progress', count: activeProjects },
      { key: 'COMPLETED', label: 'Completed', count: completedProjects },
      { key: 'CANCELLED', label: 'Cancelled', count: cancelledProjects },
    ],
    needs: needs.slice(0, 8),
    needsTotal: needs.length,
    money,
    canMoney,
  }
})
