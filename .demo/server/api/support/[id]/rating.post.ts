import { createError, defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { rateLimit, RateLimits } from '../../../utils/ratelimit'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/support/:id/rating — "How did Alex do?" on a resolved request.
 * One rating per request: it is claimed with a conditional update, so a
 * second submit is a 409 rather than a quiet overwrite. Staff see it on the
 * admin ticket.
 */
const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(1000).optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.support, identity: session.id })
  const id = getRouterParam(event, 'id')
  const { rating, note } = await validateBody(event, bodySchema)

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { userId: true, status: true } })
  if (!ticket || ticket.userId !== session.id) {
    throw createError({ statusCode: 404, message: 'Ticket not found' })
  }
  if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
    throw createError({ statusCode: 400, message: 'You can rate a request once it is resolved.' })
  }

  const claimed = await prisma.ticket.updateMany({
    where: { id, userId: session.id, rating: null },
    data: { rating, ratingNote: note || null, ratedAt: new Date() },
  })
  if (!claimed.count) {
    throw createError({ statusCode: 409, message: 'You have already rated this request.' })
  }
  return { rating }
})
