import { defineEventHandler } from 'h3'
import { creditRef } from '../../../shared/credit'
import { requireAuth } from '../../utils/auth'
import { creditLimit } from '../../utils/credit'
import prisma from '../../utils/prisma'

/**
 * GET /api/credit/application — the caller's application for the Wallet's
 * status screen: the one waiting for a decision, else the most recent decided
 * one (or null). Also the ceiling, which is the top of the amount they can ask
 * for. Staff notes are never returned.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const [app, ceiling] = await Promise.all([
    prisma.creditApplication.findFirst({
      where: { userId: session.id, status: { in: ['SUBMITTED', 'APPROVED', 'DECLINED'] } },
      orderBy: { submittedAt: 'desc' },
      include: { attachments: { select: { id: true, name: true } } },
    }),
    creditLimit(),
  ])
  return {
    ceiling,
    application: app
      ? {
          id: app.id,
          ref: creditRef(app.id),
          status: app.status,
          businessName: app.companyName ?? app.tradingName ?? '',
          companyNumber: app.companyNumber,
          requestedLimit: app.requestedLimit,
          approvedLimit: app.approvedLimit,
          statements: app.attachments.filter(a => a.id !== app.idAttachmentId).length,
          submittedAt: app.submittedAt,
          decidedAt: app.decidedAt,
        }
      : null,
  }
})
