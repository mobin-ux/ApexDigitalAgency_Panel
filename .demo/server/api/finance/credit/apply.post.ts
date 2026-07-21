import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/finance/credit/apply — apply for the Apex credit line, or
 * request a limit increase on an existing one. Approval is a human
 * decision in the admin panel (PATCH /api/admin/finance/credit/:userId).
 *
 * State machine:
 *  none / REJECTED → PENDING (fresh application)
 *  PENDING         → requestedLimit updated (application amended)
 *  ACTIVE          → requestedLimit > limit records an increase request
 *  FROZEN          → 400 (contact support — admin must unfreeze first)
 */

const bodySchema = z.object({
  requestedLimit: z.coerce.number().min(500, 'Minimum credit line is £500').max(100_000),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { requestedLimit } = await validateBody(event, bodySchema)

  const existing = await prisma.creditLine.findUnique({ where: { userId: session.id } })

  if (existing?.status === 'FROZEN') {
    throw createError({ statusCode: 400, message: 'Your credit line is frozen. Please contact support.' })
  }
  if (existing?.status === 'ACTIVE' && requestedLimit <= existing.limit) {
    throw createError({ statusCode: 400, message: 'Requested limit must be higher than your current limit.' })
  }

  const line = existing
    ? await prisma.creditLine.update({
        where: { userId: session.id },
        data: {
          requestedLimit,
          // A fresh application after rejection goes back to review.
          status: existing.status === 'REJECTED' ? 'PENDING' : existing.status,
          appliedAt: new Date(),
        },
      })
    : await prisma.creditLine.create({
        data: { userId: session.id, status: 'PENDING', requestedLimit },
      })

  return { status: 'success', credit: line }
})
