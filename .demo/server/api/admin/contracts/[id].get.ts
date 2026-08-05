import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/contracts/:id — full contract dossier for the admin
 * Contract Management module: the agreement terms and signature, the linked
 * project with milestones and files, the live repayment (installment) plan,
 * and the customer.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Contract id is required' })
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, phone: true, firstName: true, lastName: true, avatar: true, createdAt: true },
      },
      project: {
        include: {
          milestones: { orderBy: { date: 'asc' } },
          files: true,
          manager: { select: { id: true, email: true, firstName: true, lastName: true } },
          installmentPlan: true,
        },
      },
    },
  })

  if (!contract) {
    throw createError({ statusCode: 404, message: 'Contract not found' })
  }

  return { contract }
})
