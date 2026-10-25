import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { rateLimit, RateLimits } from '../../utils/ratelimit'
import { getSetting } from '../../utils/settings'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/support/create — open a support request (Panel v2 "New request").
 *
 * The customer picks a topic — a project, billing, their account or
 * something else — and, for a project, optionally which order it is about;
 * the subject may be left blank, in which case the first line of the message
 * stands in for it. Files arrive as ids from `POST /api/uploads`. A request
 * about an order is assigned to that order's project manager.
 */
const bodySchema = z.object({
  subject: z.string().trim().max(200).optional(),
  category: z.enum(['project', 'billing', 'account', 'other']).default('other'),
  relatedProjectId: z.string().uuid().optional(),
  // When omitted, the admin-configured default applies (Setting support.default-priority).
  priority: z.string().trim().min(1).max(50).optional(),
  message: z.string().trim().min(1).max(10_000),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  rateLimit(event, { ...RateLimits.support, identity: session.id })
  const body = await validateBody(event, bodySchema)
  const priority = body.priority ?? await getSetting('support.default-priority', 'NORMAL')

  // A request about an order goes to that order's project manager, which is
  // what the review step tells the customer. Anything else is unassigned and
  // picked up from the admin queue.
  let assigneeId: string | null = null
  if (body.relatedProjectId) {
    const project = await prisma.project.findFirst({ where: { id: body.relatedProjectId, userId: session.id }, select: { managerId: true } })
    if (!project) {
      throw createError({ statusCode: 404, message: 'Order not found' })
    }
    assigneeId = project.managerId
  }

  const firstLine = body.message.split('\n')[0]!.trim()
  const subject = body.subject || (firstLine.length > 60 ? `${firstLine.slice(0, 57).trim()}…` : firstLine)
  const attachmentIds = body.attachmentIds ?? []

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        userId: session.id,
        subject,
        category: body.category,
        priority,
        relatedProjectId: body.relatedProjectId ?? null,
        assigneeId,
        customerLastSeenAt: new Date(),
        messages: { create: { content: body.message, isAdmin: false, senderId: session.id } },
      },
      include: { messages: { select: { id: true } } },
    })
    if (attachmentIds.length > 0) {
      const linked = await tx.attachment.updateMany({
        where: { id: { in: attachmentIds }, uploaderId: session.id, ticketMessageId: null, projectId: null },
        data: { ticketMessageId: created.messages[0]!.id },
      })
      if (linked.count !== attachmentIds.length) {
        throw createError({ statusCode: 400, message: 'One of the files is no longer available. Please add it again.' })
      }
    }
    return created
  })

  return { status: 'success', ticket: { id: ticket.id, subject: ticket.subject } }
})
