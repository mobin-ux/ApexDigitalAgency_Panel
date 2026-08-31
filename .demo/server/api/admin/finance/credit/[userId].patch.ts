import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'
import { validateBody } from '../../../../utils/validate'

/**
 * PATCH /api/admin/finance/credit/:userId — decide on a credit line:
 * - approve: limit ← `limit` (or the requested amount), status ACTIVE
 * - adjust:  set a new limit on an existing line
 * - freeze / unfreeze: suspend or restore spending
 * - reject:  decline the application
 * All audited with before/after, and the customer is notified.
 */

const bodySchema = z.object({
  action: z.enum(['approve', 'adjust', 'freeze', 'unfreeze', 'reject']),
  limit: z.coerce.number().min(0).max(1_000_000).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'credit.approve')

  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User id is required' })
  }
  const { action, limit } = await validateBody(event, bodySchema)

  const before = await prisma.creditLine.findUnique({ where: { userId } })
  if (!before) {
    throw createError({ statusCode: 404, message: 'No credit line for this user' })
  }

  let data: Record<string, unknown>
  let note: string
  switch (action) {
    case 'approve': {
      const newLimit = limit ?? before.requestedLimit
      if (newLimit <= 0) {
        throw createError({ statusCode: 400, message: 'Approved limit must be greater than zero' })
      }
      data = { status: 'ACTIVE', limit: newLimit, approvedAt: new Date() }
      note = `Your Apex credit line of £${newLimit.toLocaleString('en-GB')} is approved and ready to use. 🎉`
      break
    }
    case 'adjust': {
      if (limit === undefined) {
        throw createError({ statusCode: 400, message: 'A limit is required for adjust' })
      }
      if (limit < before.used) {
        throw createError({ statusCode: 400, message: `Limit cannot be below the amount in use (£${before.used})` })
      }
      data = { limit }
      note = `Your Apex credit limit is now £${limit.toLocaleString('en-GB')}.`
      break
    }
    case 'freeze':
      data = { status: 'FROZEN' }
      note = 'Your Apex credit line has been frozen. Contact support if you have questions.'
      break
    case 'unfreeze':
      data = { status: 'ACTIVE' }
      note = 'Your Apex credit line is active again.'
      break
    case 'reject':
      data = { status: 'REJECTED' }
      note = 'Your Apex credit application was not approved this time. You can re-apply from the Wallet page.'
      break
  }

  const after = await prisma.creditLine.update({ where: { userId }, data })

  await prisma.notification.create({
    data: {
      userId,
      title: 'Apex credit update',
      message: note,
      type: action === 'reject' || action === 'freeze' ? 'WARNING' : 'SUCCESS',
      link: '/dashboards/wallet',
    },
  })

  await recordAudit(event, admin, {
    action: `admin.credit.${action}`,
    targetType: 'CreditLine',
    targetId: after.id,
    metadata: {
      userId,
      before: { status: before.status, limit: before.limit, used: before.used, requestedLimit: before.requestedLimit },
      after: { status: after.status, limit: after.limit, used: after.used },
    },
  })

  return { status: 'success', credit: after }
})
