import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/orders/pay — pay the FULL project amount from the wallet
 * and activate a PENDING project. This is not an installment charge
 * (ADR-010): per-installment "Pay" buttons must not call this.
 */

const bodySchema = z.object({
  projectId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { projectId } = await validateBody(event, bodySchema)

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  // 404 for both "doesn't exist" and "not yours" — don't leak other users' project ids.
  if (!project || project.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  if (project.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: 'This project is already active or completed.' })
  }

  await prisma.$transaction(async (tx) => {
    // Conditional decrement: the balance check and the debit are one
    // statement, so concurrent pay requests cannot double-spend.
    const debited = await tx.user.updateMany({
      where: { id: session.id, walletBalance: { gte: project.amount } },
      data: { walletBalance: { decrement: project.amount } },
    })
    if (debited.count === 0) {
      throw createError({ statusCode: 400, message: 'Insufficient wallet balance. Please deposit funds.' })
    }
    await tx.project.update({
      where: { id: projectId },
      data: { status: 'IN_PROGRESS', progress: 5 },
    })
    await tx.transaction.create({
      data: {
        userId: session.id,
        amount: -project.amount,
        type: 'PAYMENT',
        description: `Payment for project: ${project.name}`,
      },
    })
  })

  return { status: 'success', message: 'Project paid and activated!' }
})
