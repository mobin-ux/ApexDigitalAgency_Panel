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

  const [totalCustomers, totalProjects, activeProjects, openTickets, revenue, recentAudit] = await prisma.$transaction([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { status: 'OPEN' } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ])

  return {
    totalCustomers,
    totalProjects,
    activeProjects,
    openTickets,
    totalRevenue: revenue._sum.amount ?? 0,
    recentAudit,
  }
})
