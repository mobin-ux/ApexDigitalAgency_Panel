import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'
import { validateBody } from '../../utils/validate'

/**
 * POST /api/orders — create a PENDING project from the New Order wizard.
 * Contract: { title, category, budget }. `description` is intentionally
 * not persisted — Project has no such column (see ARCHITECTURE §5).
 */

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  budget: z.coerce.number().min(0).default(0),
})

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const { title, category, budget } = await validateBody(event, bodySchema)

  const newProject = await prisma.project.create({
    data: {
      name: title,
      category,
      amount: budget,
      status: 'PENDING',
      progress: 0,
      startDate: new Date(),
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // default 2-week deadline
      userId: session.id,
      // Default milestones so the order timeline renders immediately.
      milestones: {
        create: [
          { title: 'Order Review', status: 'PENDING' },
          { title: 'Requirements', status: 'PENDING' },
          { title: 'Development', status: 'PENDING' },
          { title: 'Delivery', status: 'PENDING' },
        ],
      },
    },
  })

  return { status: 'success', project: newProject }
})
