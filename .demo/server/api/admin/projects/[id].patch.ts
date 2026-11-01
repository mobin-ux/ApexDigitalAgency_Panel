import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { notify } from '../../../utils/notify'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'
import { cancelProject } from '../../../utils/project-lifecycle'
import { validateBody } from '../../../utils/validate'

/**
 * PATCH /api/admin/projects/:id — whitelisted project update.
 * `amount` (the agreed value) is editable only on a project with no signed
 * agreement. Once the client has signed, the price is the agreement's and
 * the plan's (ADR-025): changing it here would show the client a total that
 * differs from what they agreed and from the cash price, so it is refused.
 * Money itself only moves through transactions either way.
 *
 * Status moves keep both panels on one answer (ADR-025, phase 4): work on a
 * paid-kickoff order starts through the kickoff action, which takes the
 * payment and starts the plan, never by flipping the status; cancelling ends
 * the plan and the agreement with the project (`cancelProject`); and a
 * cancelled project stays cancelled. The client hears about each change of
 * status and target date, and a newly assigned manager hears about the work.
 */

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED']).optional(),
    amount: z.coerce.number().min(0).max(10_000_000).optional(),
    progress: z.coerce.number().int().min(0).max(100).optional(),
    deadline: z.coerce.date().nullable().optional(),
    managerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

const auditedFields = {
  id: true,
  name: true,
  category: true,
  status: true,
  amount: true,
  progress: true,
  deadline: true,
  managerId: true,
} as const

/** What the client is told when staff move their project to a status. */
const STATUS_NOTICE: Record<string, { title: string, message: (name: string) => string, type: 'INFO' | 'SUCCESS' | 'WARNING' }> = {
  IN_PROGRESS: { title: 'Work is under way', message: name => `${name} is in progress.`, type: 'INFO' },
  IN_REVIEW: { title: 'Ready for your review', message: name => `${name} is ready for you to review. Open the project to see what is new.`, type: 'INFO' },
  COMPLETED: { title: 'Project complete', message: name => `${name} is complete.`, type: 'SUCCESS' },
  CANCELLED: { title: 'Project cancelled', message: name => `${name} has been cancelled.`, type: 'WARNING' },
}

export default defineEventHandler(async (event) => {
  const admin = await requireStaffPermission(event, 'work.assign')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Project id is required' })
  }

  const updates = await validateBody(event, bodySchema)

  const before = await prisma.project.findUnique({
    where: { id },
    select: { ...auditedFields, userId: true, signedAt: true, kickoffAmount: true, kickoffPaidAt: true, contract: { select: { id: true } } },
  })
  if (!before) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  if (updates.amount !== undefined && updates.amount !== before.amount && (before.signedAt || before.contract)) {
    throw createError({ statusCode: 409, message: 'The client has signed an agreement for this project, so its value is fixed. Cancel and re-quote instead.' })
  }

  const statusChange = updates.status !== undefined && updates.status !== before.status ? updates.status : null
  if (statusChange) {
    if (before.status === 'CANCELLED') {
      throw createError({ statusCode: 409, message: 'A cancelled project stays cancelled: its plan and agreement have ended. Place a new order instead.' })
    }
    if (statusChange === 'IN_PROGRESS' && before.status === 'PENDING' && !before.kickoffPaidAt && before.kickoffAmount > 0) {
      throw createError({ statusCode: 409, message: 'Work on this order starts with the kickoff: use “Kickoff done · collect”, which takes the kickoff payment and starts the plan.' })
    }
    if (statusChange === 'PENDING' && before.kickoffPaidAt) {
      throw createError({ statusCode: 409, message: 'The kickoff payment has been taken and work has started, so this project cannot go back to awaiting kickoff.' })
    }
  }

  if (updates.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: updates.managerId }, select: { role: true } })
    if (!manager || manager.role === 'CUSTOMER') {
      throw createError({ statusCode: 400, message: 'Manager must be an admin or employee account' })
    }
  }

  const { after, ended } = await prisma.$transaction(async (tx) => {
    if (statusChange === 'CANCELLED') {
      const { status: _status, ...rest } = updates
      if (Object.keys(rest).length > 0) {
        await tx.project.update({ where: { id }, data: rest })
      }
      const outcome = await cancelProject(tx, id)
      return { after: await tx.project.findUniqueOrThrow({ where: { id }, select: auditedFields }), ended: outcome }
    }
    return { after: await tx.project.update({ where: { id }, data: updates, select: auditedFields }), ended: null }
  })

  const { userId: _userId, signedAt: _signedAt, kickoffAmount: _kickoffAmount, kickoffPaidAt: _kickoffPaidAt, contract: _contract, ...beforeAudit } = before
  await recordAudit(event, admin, {
    action: 'admin.project.update',
    targetType: 'Project',
    targetId: id,
    metadata: { before: beforeAudit, after, ...(ended ? { cancelled: ended } : {}) },
  })

  const link = `/dashboards/orders?project=${id}`
  if (statusChange && STATUS_NOTICE[statusChange]) {
    const notice = STATUS_NOTICE[statusChange]!
    const stopped = ended?.planStopped ? ' No further payments will be taken for it.' : ''
    await notify({ userIds: [before.userId], title: notice.title, message: notice.message(after.name) + stopped, type: notice.type, link })
  }
  const deadlineMoved = updates.deadline !== undefined && after.status !== 'CANCELLED'
    && (before.deadline?.getTime() ?? null) !== (after.deadline?.getTime() ?? null)
  if (deadlineMoved) {
    await notify({
      userIds: [before.userId],
      title: 'Target date updated',
      message: after.deadline
        ? `${after.name} is now due on ${after.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : `${after.name} no longer has a target date.`,
      type: 'INFO',
      link,
    })
  }
  if (after.managerId && after.managerId !== before.managerId) {
    await notify({
      userIds: [after.managerId],
      title: `You manage ${after.name}`,
      message: 'This project has been assigned to you.',
      type: 'INFO',
      link: `/admin/projects/${id}`,
      excludeUserId: admin.id,
    })
  }

  return after
})
