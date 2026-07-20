import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

/**
 * GET /api/orders — the caller's projects with milestones, files and
 * manager. Returns raw records; all presentation mapping happens in the
 * front-end computed properties.
 */
export default defineEventHandler(async (event) => {
  const session = requireAuth(event)

  const projects = await prisma.project.findMany({
    where: { userId: session.id },
    include: {
      milestones: { orderBy: { date: 'asc' } },
      files: true,
      manager: { select: { firstName: true, lastName: true, avatar: true } },
      installmentPlan: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return { data: projects }
})
