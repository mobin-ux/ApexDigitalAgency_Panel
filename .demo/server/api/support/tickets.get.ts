import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { projectManagerFor, staffName } from '../../utils/support'

/**
 * GET /api/support/tickets — the caller's tickets, newest activity first, with
 * the latest message the customer is allowed to see and the order it is about,
 * plus the project manager the Support page introduces (or null).
 *
 * The latest-message include filters out internal staff notes. It used to
 * take the newest message of any kind, so an internal note could become the
 * preview line in the customer's own inbox.
 *
 * `lastAuthor` names whoever wrote that latest message when it was staff, for
 * "Alex asked 2 hours ago"; `assignee` is who handles the request.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const [rows, manager] = await Promise.all([
    prisma.ticket.findMany({
      where: { userId: session.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        relatedProject: { select: { id: true, name: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
    }),
    projectManagerFor(session.id),
  ])

  const senderIds = [...new Set(rows.map(t => t.messages[0]).filter(m => m?.isAdmin && m.senderId).map(m => m!.senderId!))]
  const senders = senderIds.length
    ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, firstName: true, lastName: true } })
    : []
  const names = new Map(senders.map(u => [u.id, staffName(u)]))

  const tickets = rows.map(({ assignee, messages, ...t }) => ({
    ...t,
    messages: messages.map(({ senderId: _s, ...m }) => m),
    assignee: staffName(assignee) || null,
    lastAuthor: messages[0]?.isAdmin ? (names.get(messages[0].senderId ?? '') || null) : null,
  }))

  return { tickets, manager }
})
