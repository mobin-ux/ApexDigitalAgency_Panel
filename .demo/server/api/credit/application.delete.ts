import { createError, defineEventHandler } from 'h3'
import { recordAudit } from '../../utils/audit'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { deleteAttachments } from '../../utils/uploads'

/**
 * DELETE /api/credit/application — withdraw the application that is waiting
 * for a decision. The row stays, stamped WITHDRAWN, so the audit trail keeps
 * its subject; the photo ID and statements are deleted straight away, which
 * is what the confirmation tells the customer.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const app = await prisma.creditApplication.findFirst({
    where: { userId: session.id, status: 'SUBMITTED' },
    include: { attachments: { select: { id: true, path: true } } },
  })
  if (!app) {
    throw createError({ statusCode: 404, message: 'There is no application waiting for a decision.' })
  }
  // Conditional, so a withdrawal racing a staff decision settles once.
  const claimed = await prisma.creditApplication.updateMany({
    where: { id: app.id, status: 'SUBMITTED' },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date(), idAttachmentId: null },
  })
  if (claimed.count === 0) {
    throw createError({ statusCode: 409, message: 'We have just decided this application. Refresh to see the result.' })
  }
  await deleteAttachments(app.attachments)
  await recordAudit(event, { id: session.id, email: session.email ?? session.id }, {
    action: 'credit.withdrawn',
    targetType: 'CreditApplication',
    targetId: app.id,
    metadata: { filesDeleted: app.attachments.length },
  })
  return { status: 'withdrawn' }
})
