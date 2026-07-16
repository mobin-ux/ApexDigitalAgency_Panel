import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/users/:id — full customer detail for the admin panel:
 * profile, balances, and the 10 most recent projects / transactions /
 * tickets plus total counts.
 */

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'User id is required' })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    // Explicit select — never expose the password hash.
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      avatar: true,
      bio: true,
      gender: true,
      birthDate: true,
      city: true,
      country: true,
      walletBalance: true,
      adCredits: true,
      createdAt: true,
      updatedAt: true,
      projects: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, category: true, status: true, amount: true, progress: true, createdAt: true },
      },
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, amount: true, type: true, status: true, description: true, createdAt: true },
      },
      tickets: {
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, subject: true, status: true, priority: true, category: true, updatedAt: true },
      },
      _count: {
        select: { projects: true, transactions: true, tickets: true, installments: true, withdrawalRequests: true },
      },
    },
  })

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return user
})
