import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { creditRef } from '../../../../../../shared/credit'
import { recordAudit } from '../../../../../utils/audit'
import { creditLimit } from '../../../../../utils/credit'
import { requireStaffPermission } from '../../../../../utils/permissions'
import prisma from '../../../../../utils/prisma'
import { validateBody } from '../../../../../utils/validate'

/**
 * POST /api/admin/credit/applications/:id/decide — approve (with a limit, at
 * most the ceiling) or decline a credit application. Approving creates or
 * replaces the customer's CreditLine in the same transaction. The application
 * is claimed with a conditional update, so a decision racing a withdrawal (or
 * a second reviewer) settles once. The note is internal: it goes to the audit
 * log and the admin screen, never to the customer.
 */
const bodySchema = z.object({
  action: z.enum(['approve', 'decline']),
  limit: z.number().int().min(500).optional(),
  note: z.string().trim().max(500).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'credit.approve')
  const id = getRouterParam(event, 'id')
  const { action, limit, note } = await validateBody(event, bodySchema)

  const app = await prisma.creditApplication.findUnique({ where: { id } })
  if (!app) {
    throw createError({ statusCode: 404, message: 'Application not found' })
  }
  if (app.status !== 'SUBMITTED') {
    throw createError({ statusCode: 409, message: `This application is already ${app.status.toLowerCase()}.` })
  }

  const ceiling = await creditLimit()
  const approved = limit ?? app.requestedLimit
  if (action === 'approve' && approved > ceiling) {
    throw createError({ statusCode: 400, message: `The most you can approve is £${ceiling.toLocaleString('en-GB')} (the credit ceiling in Platform settings).` })
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.creditApplication.updateMany({
      where: { id: app.id, status: 'SUBMITTED' },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'DECLINED',
        approvedLimit: action === 'approve' ? approved : null,
        decisionNote: note || null,
        decidedById: admin.id,
        decidedAt: now,
      },
    })
    if (claimed.count === 0) {
      throw createError({ statusCode: 409, message: 'This application changed while you were deciding. Refresh and look again.' })
    }
    if (action === 'approve') {
      await tx.creditLine.upsert({
        where: { userId: app.userId },
        create: { userId: app.userId, status: 'ACTIVE', limit: approved, requestedLimit: app.requestedLimit, appliedAt: app.submittedAt, approvedAt: now },
        update: { status: 'ACTIVE', limit: approved, requestedLimit: app.requestedLimit, appliedAt: app.submittedAt, approvedAt: now },
      })
    }
  })

  const ref = creditRef(app.id)
  await prisma.notification.create({
    data: {
      userId: app.userId,
      title: action === 'approve' ? 'Credit line approved' : 'Credit application not approved',
      message: action === 'approve'
        ? `Your credit line of £${approved.toLocaleString('en-GB')} is ready to use. You can now run more than one plan at once.`
        : `We cannot offer a credit line on ${ref} at the moment. You can still order any service on a monthly plan, one at a time.`,
      type: action === 'approve' ? 'SUCCESS' : 'WARNING',
      link: '/dashboards/wallet',
    },
  })
  await recordAudit(event, admin, {
    action: `admin.credit.${action}`,
    targetType: 'CreditApplication',
    targetId: app.id,
    reason: note || undefined,
    metadata: { userId: app.userId, ref, requestedLimit: app.requestedLimit, approvedLimit: action === 'approve' ? approved : null },
  })

  return { status: action === 'approve' ? 'APPROVED' : 'DECLINED' }
})
