import { defineEventHandler } from 'h3'
import { orderRef, ticketRef } from '../../../shared/refs'
import { requireAuth } from '../../utils/auth'
import { ensureCredit } from '../../utils/credit'
import prisma from '../../utils/prisma'

/**
 * GET /api/dashboard/overview — everything the Panel v2 dashboard renders, in
 * one round trip. Raw numbers; the page formats them.
 *
 * "Waiting on you" is built only from things that really are waiting on the
 * customer: a request their team raised (`ClientAction`), a support request
 * whose latest message is from staff and still open, and an order that cannot
 * start until its kickoff call is arranged. Nothing here is inferred from a
 * project's percentage or a date.
 */
const ACTIVE = ['PENDING', 'IN_PROGRESS', 'IN_REVIEW']

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const userId = session.id

  const [user, projects, actions, tickets, plans, payments, credit] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, walletBalance: true } }),
    prisma.project.findMany({
      where: { userId, status: { in: ACTIVE } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, category: true, planName: true, serviceId: true, status: true, progress: true, deadline: true, kickoffPaidAt: true, payMode: true, createdAt: true },
    }),
    prisma.clientAction.findMany({
      where: { userId, status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, ctaLabel: true, project: { select: { id: true, name: true } } },
    }),
    prisma.ticket.findMany({
      where: { userId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: {
        id: true,
        subject: true,
        relatedProjectId: true,
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'desc' }, take: 1, select: { isAdmin: true } },
      },
    }),
    prisma.installment.findMany({
      where: { userId, status: { in: ['active', 'pending'] } },
      orderBy: { nextDue: 'asc' },
      select: { id: true, project: true, projectId: true, kind: true, status: true, monthlyAmount: true, amountDue: true, monthsPaid: true, monthsTotal: true, nextDue: true, paid: true, total: true },
    }),
    prisma.transaction.findMany({
      where: { userId, type: 'PAYMENT', amount: { lt: 0 } },
      select: { amount: true, projectId: true, installmentId: true },
    }),
    ensureCredit(userId),
  ])

  const openTicketProjects = new Set(tickets.map(t => t.relatedProjectId).filter(Boolean))
  const needs = [
    ...actions.map(a => ({
      kind: 'action' as const,
      title: a.title,
      context: `${a.project.name} · ${orderRef(a.project.id)}`,
      cta: a.ctaLabel,
      to: `/dashboards/orders?project=${a.project.id}`,
    })),
    ...tickets
      .filter(t => t.messages[0]?.isAdmin)
      .map(t => ({
        kind: 'ticket' as const,
        title: `Reply about ${t.subject.charAt(0).toLowerCase()}${t.subject.slice(1)}`,
        context: `Support · ${ticketRef(t.id)}`,
        cta: 'Reply',
        to: `/dashboards/support?ticket=${t.id}`,
      })),
    // An order cannot start until its kickoff call is arranged — unless a
    // support request about it is already open, which is that conversation.
    ...projects
      .filter(p => p.status === 'PENDING' && p.serviceId && !p.kickoffPaidAt && !openTicketProjects.has(p.id))
      .map(p => ({
        kind: 'kickoff' as const,
        title: 'Book your kickoff call',
        context: `${p.name} · ${orderRef(p.id)}`,
        cta: 'Book',
        to: `/dashboards/support?new=kickoff&order=${p.id}`,
      })),
  ]

  // Next payment: the soonest active instalment, and the per-plan progress
  // under it (the two soonest plans, as drawn).
  const active = plans.filter(p => p.status === 'active')
  const next = active[0] ?? null
  const nextPlans = active.slice(0, 2).map(p => ({
    name: p.project,
    amount: p.monthlyAmount || p.amountDue,
    paid: p.monthsPaid,
    total: p.monthsTotal,
    retainer: p.kind === 'retainer',
  }))

  // Paid so far, split by order. A payment is attributed by its own
  // `projectId`, or through the plan it settled; if anything is left over the
  // split is withheld rather than shown with a part missing (Phase 2 rule).
  const planProject = new Map(plans.map(p => [p.id, p.projectId]))
  const legacyPlans = await prisma.installment.findMany({
    where: { userId, id: { in: payments.map(t => t.installmentId).filter((v): v is string => Boolean(v)) } },
    select: { id: true, projectId: true },
  })
  for (const p of legacyPlans) {
    planProject.set(p.id, p.projectId)
  }
  const byProject = new Map<string, number>()
  let paidTotal = 0
  let unattributed = 0
  for (const t of payments) {
    const amount = Math.abs(t.amount)
    paidTotal += amount
    const pid = t.projectId ?? (t.installmentId ? planProject.get(t.installmentId) : null)
    if (pid) {
      byProject.set(pid, (byProject.get(pid) ?? 0) + amount)
    }
    else {
      unattributed += amount
    }
  }
  const names = byProject.size
    ? new Map((await prisma.project.findMany({ where: { id: { in: [...byProject.keys()] } }, select: { id: true, name: true } })).map(p => [p.id, p.name]))
    : new Map<string, string>()
  const split = unattributed < 0.01
    ? [...byProject.entries()].map(([id, amount]) => ({ id, name: names.get(id) ?? 'Order', amount })).sort((a, b) => b.amount - a.amount)
    : null

  return {
    firstName: user?.firstName ?? null,
    walletBalance: user?.walletBalance ?? 0,
    needs,
    nextPayment: next
      ? { amount: next.monthlyAmount || next.amountDue, due: next.nextDue, plans: nextPlans }
      : null,
    credit: { status: credit.status, limit: credit.limit, used: credit.used, available: credit.available },
    projects: projects.map(p => ({
      id: p.id,
      ref: orderRef(p.id),
      name: p.name,
      service: p.category,
      plan: p.planName,
      serviceId: p.serviceId,
      status: p.status,
      progress: p.progress ?? 0,
      deadline: p.deadline,
      awaitingKickoff: p.status === 'PENDING',
    })),
    paid: {
      total: Math.round(paidTotal * 100) / 100,
      count: payments.length,
      projects: byProject.size,
      split,
    },
  }
})
