import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { recordAudit } from '../../../utils/audit'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { validateBody } from '../../../utils/validate'

/**
 * POST /api/admin/projects — create a project on behalf of a customer.
 * Mirrors the customer wizard's shape (default milestone timeline) but
 * lets the admin pick the owner, status, deadline and manager directly.
 */

const bodySchema = z.object({
  userId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  amount: z.coerce.number().min(0).max(10_000_000).default(0),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  deadline: z.coerce.date().nullable().optional(),
  managerId: z.string().trim().min(1).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const data = await validateBody(event, bodySchema)

  const owner = await prisma.user.findUnique({ where: { id: data.userId }, select: { id: true, email: true } })
  if (!owner) {
    throw createError({ statusCode: 400, message: 'Owner not found' })
  }

  if (data.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: data.managerId }, select: { role: true } })
    if (!manager || manager.role === 'CUSTOMER') {
      throw createError({ statusCode: 400, message: 'Manager must be an admin or employee account' })
    }
  }

  const project = await prisma.project.create({
    data: {
      name: data.name,
      category: data.category,
      amount: data.amount,
      status: data.status,
      progress: 0,
      startDate: new Date(),
      deadline: data.deadline ?? null,
      userId: data.userId,
      managerId: data.managerId ?? null,
      // Same default timeline the customer wizard creates.
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

  await recordAudit(event, admin, {
    action: 'admin.project.create',
    targetType: 'Project',
    targetId: project.id,
    metadata: { name: project.name, owner: owner.email, amount: project.amount, status: project.status },
  })

  return project
})
