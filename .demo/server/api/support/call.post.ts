import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { callLabel, isCallSlot } from '../../../shared/support-call'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { projectManagerFor } from '../../utils/support'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/support/call — ask for a 30-minute video call (Support "Book a
 * call"). There is no calendar behind it: the preferred slot becomes a
 * support request, assigned to the project manager, and staff confirm by
 * replying. The customer is told exactly that.
 *
 * With `orderId` (the kickoff link from My orders and the dashboard) the
 * request is about that order and goes to its manager; without it, to the
 * manager of the newest active order. One open call request at a time: a
 * second one moves the slot on the open request and says so in the thread.
 */
const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().trim().max(1000).optional(),
  orderId: z.string().uuid().optional(),
}).strict()

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.support, identity: session.id })
  const { date, time, note, orderId } = await validateBody(event, bodySchema)

  if (!isCallSlot(date, time)) {
    throw createError({ statusCode: 400, message: 'That time is no longer available. Choose another.' })
  }
  const slot = `${date} ${time}`
  const label = callLabel(slot)

  let order: { id: string, managerId: string | null } | null = null
  if (orderId) {
    order = await prisma.project.findFirst({ where: { id: orderId, userId: session.id }, select: { id: true, managerId: true } })
    if (!order) {
      throw createError({ statusCode: 404, message: 'Order not found' })
    }
  }

  const open = await prisma.ticket.findFirst({
    where: { userId: session.id, callSlot: { not: null }, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  if (open) {
    const content = `Could we move the call to ${label} (UK time) instead?${note ? `\n\n${note}` : ''}`
    await prisma.$transaction([
      prisma.ticketMessage.create({ data: { ticketId: open.id, content, isAdmin: false, senderId: session.id } }),
      prisma.ticket.update({ where: { id: open.id }, data: { callSlot: slot, subject: `Call request · ${label}`, status: 'OPEN' } }),
    ])
    return { ticket: { id: open.id }, slot }
  }

  const pm = order ? null : await projectManagerFor(session.id)
  const content = `I would like a 30-minute video call on ${label} (UK time).${note ? `\n\n${note}` : ''}`
  const ticket = await prisma.ticket.create({
    data: {
      userId: session.id,
      subject: `Call request · ${label}`,
      category: 'project',
      relatedProjectId: order?.id ?? pm?.orderId ?? null,
      assigneeId: order ? order.managerId : (pm?.id ?? null),
      callSlot: slot,
      customerLastSeenAt: new Date(),
      messages: { create: { content, isAdmin: false, senderId: session.id } },
    },
    select: { id: true },
  })
  return { ticket, slot }
})
