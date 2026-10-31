import { defineEventHandler } from 'h3'
import { creditRef } from '../../../../../shared/credit'
import { can } from '../../../../../shared/permissions'
import { creditLimit } from '../../../../utils/credit'
import { requireStaffPermission } from '../../../../utils/permissions'
import prisma from '../../../../utils/prisma'

/**
 * GET /api/admin/credit/applications — the Credit screen in one call:
 * applications waiting for a decision (oldest first, it is a queue), the
 * last fifty decided or withdrawn, every credit line in place, and the
 * ceiling a decision may not exceed. `canDecide` says whether this role may
 * approve, so the screen shows the buttons only to people the endpoint will
 * accept them from.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireStaffPermission(event, 'money.view')
  const user = { select: { id: true, email: true, phone: true, firstName: true, lastName: true, avatar: true } }

  const [waiting, decided, lines, ceiling] = await Promise.all([
    prisma.creditApplication.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
      include: { user, attachments: { select: { id: true, name: true, size: true } } },
    }),
    prisma.creditApplication.findMany({
      where: { status: { not: 'SUBMITTED' } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      include: { user },
    }),
    prisma.creditLine.findMany({
      where: { status: { in: ['ACTIVE', 'FROZEN'] }, limit: { gt: 0 } },
      orderBy: { approvedAt: 'desc' },
      include: { user },
    }),
    creditLimit(),
  ])

  const shape = (a: (typeof waiting)[number] | (typeof decided)[number]) => ({
    ...a,
    ref: creditRef(a.id),
    files: 'attachments' in a
      ? a.attachments.map(f => ({ ...f, isId: f.id === a.idAttachmentId }))
      : [],
  })

  return {
    canDecide: can((staff.staffRole ?? 'owner') as Parameters<typeof can>[0], 'credit.approve'),
    ceiling,
    waiting: waiting.map(shape),
    decided: decided.map(shape),
    lines,
  }
})
