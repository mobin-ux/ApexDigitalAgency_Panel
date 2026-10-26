import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { unclaimedBy } from '../../../utils/uploads'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/support/:id/reply — the customer replies, optionally with files
 * already uploaded through `POST /api/uploads`. Replying reopens a resolved
 * request and moves it back to "With Apex".
 */
// A reply may be files alone, as the design allows; then the content is empty
// and the thread shows only the files.
const bodySchema = z.object({
  content: z.string().trim().max(10_000).default(''),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
}).refine(b => b.content.length > 0 || (b.attachmentIds?.length ?? 0) > 0, { message: 'Write a reply or attach a file', path: ['content'] })

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.support, identity: session.id })

  const ticketId = getRouterParam(event, 'id')
  if (!ticketId) {
    throw createError({ statusCode: 400, message: 'Ticket id is required' })
  }

  const { content, attachmentIds = [] } = await validateBody(event, bodySchema)

  // 404 for both "doesn't exist" and "not yours" — don't leak ticket ids.
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { userId: true } })
  if (!ticket || ticket.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketMessage.create({
      data: { ticketId, content, isAdmin: false, senderId: session.id },
    })
    if (attachmentIds.length > 0) {
      const linked = await tx.attachment.updateMany({
        where: { id: { in: attachmentIds }, ...unclaimedBy(session.id) },
        data: { ticketMessageId: created.id },
      })
      if (linked.count !== attachmentIds.length) {
        throw createError({ statusCode: 400, message: 'One of the files is no longer available. Please add it again.' })
      }
    }
    // Bump the ticket so it sorts to the top of the inbox and reopens if resolved.
    await tx.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date(), status: 'OPEN' } })
    return created
  })

  return { status: 'success', message }
})
