import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { deleteAttachments } from '../../utils/uploads'

/**
 * DELETE /api/uploads/:id — discard one of the caller's own uploads that is
 * not attached to anything yet: a replaced photo ID or a statement removed
 * from a credit application before sending. Once a file belongs to an order,
 * a ticket or an application it stays with that record, so this 404s.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const id = getRouterParam(event, 'id')
  const row = await prisma.attachment.findFirst({
    where: { id, uploaderId: session.id, projectId: null, ticketMessageId: null, creditApplicationId: null },
    select: { id: true, path: true },
  })
  if (!row) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  await deleteAttachments([row])
  return { status: 'deleted' }
})
