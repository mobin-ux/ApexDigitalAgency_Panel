import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { chargeInstallment, validationErrorFromCharge } from '../../../../utils/finance'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * PATCH /api/admin/finance/installments/:id — admin actions on a plan:
 * - charge: collect the due installment from the customer wallet
 *   (identical money path as the customer's own Pay button).
 * - waive:  advance the schedule one month with NO money movement
 *   (goodwill/comp) — the waived amount is deducted from the plan total
 *   so `paid` still converges on `total`.
 * Both audited with before/after counters.
 */

const bodySchema = z.object({
  action: z.enum(['charge', 'waive']),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'money.view')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Plan id is required' })
  }
  const { action } = await validateBody(event, bodySchema)

  const before = await prisma.installment.findUnique({ where: { id } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Installment plan not found' })
  }

  if (action === 'charge') {
    const result = await chargeInstallment(id, { actorNote: `charged by ${admin.email}` })
    if (!result.ok) {
      validationErrorFromCharge(result.reason!)
    }
  }
  else {
    if (before.status === 'settled' || before.monthsPaid >= before.monthsTotal) {
      throw createError({ statusCode: 400, message: 'This plan is already fully paid.' })
    }
    const waived = Math.round(Math.min(before.monthlyAmount || before.amountDue, Math.max(0, before.total - before.paid)) * 100) / 100
    const monthsPaid = before.monthsPaid + 1
    const settled = monthsPaid >= before.monthsTotal
    const nextDue = new Date(before.nextDue)
    nextDue.setMonth(nextDue.getMonth() + 1)
    await prisma.installment.update({
      where: { id },
      data: {
        total: Math.round((before.total - waived) * 100) / 100,
        monthsPaid,
        amountDue: settled ? 0 : before.monthlyAmount,
        nextDue,
        status: settled ? 'settled' : 'active',
      },
    })
    await prisma.notification.create({
      data: {
        userId: before.userId,
        title: 'Installment waived',
        message: `Installment ${monthsPaid} of ${before.monthsTotal} for ${before.project} was waived by Apex — nothing to pay this month.`,
        type: 'SUCCESS',
        link: '/dashboards/wallet',
      },
    })
  }

  const after = await prisma.installment.findUnique({ where: { id } })
  await recordAudit(event, admin, {
    action: `admin.installment.${action}`,
    targetType: 'Installment',
    targetId: id,
    metadata: {
      before: { paid: before.paid, monthsPaid: before.monthsPaid, total: before.total, status: before.status },
      after: after ? { paid: after.paid, monthsPaid: after.monthsPaid, total: after.total, status: after.status } : null,
    },
  })

  return { status: 'success', plan: after }
})
