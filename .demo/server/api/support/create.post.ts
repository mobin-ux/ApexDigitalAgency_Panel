import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/** POST /api/support/create — open a ticket with its first message. */

const bodySchema = z.object({
  subject: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  priority: z.string().trim().min(1).max(50).default('NORMAL'),
  message: z.string().trim().min(1).max(10_000),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const body = await validateBody(event, bodySchema)

  const ticket = await prisma.ticket.create({
    data: {
      userId: session.id,
      subject: body.subject,
      category: body.category,
      priority: body.priority,
      messages: {
        create: {
          content: body.message,
          isAdmin: false,
          senderId: session.id,
        },
      },
    },
  })

  return { status: 'success', ticket }
})
