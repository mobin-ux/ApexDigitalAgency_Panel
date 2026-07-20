import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { chargeInstallment, validationErrorFromCharge } from '../../../../utils/finance'
import prisma from '../../../../utils/prisma'

/**
 * POST /api/finance/installments/:id/pay — pay ONE monthly installment
 * from the wallet. Ownership-checked; the charge itself is atomic
 * (conditional debit — no double-spend on double-click).
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Plan id is required' })
  }

  // 404 for both "doesn't exist" and "not yours".
  const plan = await prisma.installment.findUnique({ where: { id }, select: { userId: true } })
  if (!plan || plan.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Installment plan not found' })
  }

  const result = await chargeInstallment(id)
  if (!result.ok) {
    validationErrorFromCharge(result.reason!)
  }

  const updated = await prisma.installment.findUnique({ where: { id } })
  return { status: 'success', charged: result.charged, settled: result.settled, plan: updated }
})
