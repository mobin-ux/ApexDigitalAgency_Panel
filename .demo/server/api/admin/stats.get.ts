import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/admin/stats — headline aggregates for the future admin
 * dashboard, plus the 10 most recent audit entries (which also makes
 * the audit trail inspectable without direct DB access).
 * Raw numbers only — formatting is the client's job (same convention
 * as /api/dashboard/stats).
 */

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [totalCustomers, newCustomers30d, suspendedUsers, totalProjects, activeProjects, pendingProjects, openTickets, unassignedTickets, revenue, revenue30d, pendingWithdrawals, recentAudit] = await prisma.$transaction([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.project.count({ where: { status: 'PENDING' } }),
    prisma.ticket.count({ where: { status: 'OPEN' } }),
    prisma.ticket.count({ where: { assigneeId: null, status: { in: ['OPEN', 'PENDING'] } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT' } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.withdrawalRequest.count({ where: { status: 'Processing' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ])

  return {
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
  }
})
