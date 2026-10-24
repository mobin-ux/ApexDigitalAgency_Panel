import { createError, defineEventHandler, getRouterParam } from 'h3'
import { can } from '../../../shared/permissions'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { sendAttachment } from '../../utils/uploads'

/**
 * GET /api/attachments/:id — download an uploaded file.
 *
 * Who may read it: the uploader; the customer who owns the ticket or project
 * it is attached to (never a staff-internal message); and staff whose role
 * can see that kind of record. Everyone else gets the same 404 as a missing
 * file, so ids cannot be probed.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  const row = await prisma.attachment.findUnique({
    where: { id },
    include: {
      ticketMessage: { select: { isInternal: true, ticket: { select: { userId: true } } } },
      project: { select: { userId: true } },
    },
  })
  if (!row) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  let allowed = row.uploaderId === session.id
    || (row.project?.userId === session.id)
    || (row.ticketMessage?.ticket.userId === session.id && !row.ticketMessage.isInternal)

  if (!allowed) {
    const staff = await prisma.user.findUnique({ where: { id: session.id }, select: { role: true, status: true, staffRole: true } })
    if (staff?.role === 'ADMIN' && staff.status !== 'SUSPENDED') {
      const role = (staff.staffRole ?? 'owner') as Parameters<typeof can>[0]
      allowed = row.ticketMessage ? can(role, 'support.answer') : can(role, 'work.view')
    }
  }
  if (!allowed) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  return sendAttachment(event, row)
})
