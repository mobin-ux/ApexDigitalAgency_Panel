import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import prisma from '../../utils/prisma'
import { validateQuery } from '../../utils/validate'

const querySchema = z.object({
  to: z.string().trim().min(1).max(254),
})

/**
 * The newest outbox rows for one address, with their rendered text. Dev
 * only, like the seed routes: the API test suites read reset, verification
 * and invite links from here instead of the server console, which no longer
 * prints them. Does not exist in a production build — the text carries live
 * tokens, and the admin endpoint never returns it.
 */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const { to } = validateQuery(event, querySchema)
  const items = await prisma.mailMessage.findMany({
    where: { to },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, kind: true, subject: true, status: true, attempts: true, lastError: true, providerId: true, text: true, createdAt: true },
  })
  return { items }
})
