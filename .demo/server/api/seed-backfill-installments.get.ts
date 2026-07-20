import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '../utils/auth'
import { planFor, planIcon } from '../utils/finance'
import prisma from '../utils/prisma'

/**
 * GET /api/seed-backfill-installments — dev-only. Creates a real
 * financing plan for every project of the signed-in user that predates
 * the Installment↔Project link. Counters are seeded from project
 * progress so local data looks lived-in; settled plans for completed
 * projects. Legacy orphan plan rows (no projectId) are removed so the
 * wallet doesn't show duplicates.
 */
export default defineEventHandler(async (event) => {
  // Dev-only seed/bootstrap endpoint — must never exist in a production build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const session = requireAuth(event)

  const orphans = await prisma.installment.deleteMany({ where: { userId: session.id, projectId: null } })

  const projects = await prisma.project.findMany({
    where: { userId: session.id, amount: { gt: 0 }, installmentPlan: null },
  })

  let created = 0
  for (const project of projects) {
    const termMonths = (project.termMonths === 24 ? 24 : 12) as 12 | 24
    const financing = planFor(project.amount, termMonths)
    const completed = project.status === 'COMPLETED'
    const monthsPaid = completed
      ? termMonths
      : Math.min(termMonths - 1, Math.max(0, Math.floor(((project.progress ?? 0) / 100) * termMonths)))
    const monthly = Math.round(financing.monthlyAmount * 100) / 100
    const nextDue = new Date(project.startDate)
    nextDue.setMonth(nextDue.getMonth() + monthsPaid + 1)

    await prisma.installment.create({
      data: {
        project: project.name,
        total: Math.round(financing.totalAmount * 100) / 100,
        paid: Math.round(monthly * monthsPaid * 100) / 100,
        amountDue: completed ? 0 : monthly,
        monthsTotal: termMonths,
        monthsPaid,
        nextDue,
        status: completed ? 'settled' : 'active',
        icon: planIcon(project.category),
        monthlyAmount: monthly,
        termMonths,
        interestRate: financing.interestRate,
        projectId: project.id,
        userId: session.id,
      },
    })
    created += 1
  }

  return { status: 'success', created, orphansRemoved: orphans.count }
})
