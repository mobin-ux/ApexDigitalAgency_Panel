import { createError, defineEventHandler, getRouterParam } from 'h3'
import { can } from '../../../../shared/permissions'
import { requireStaffPermission } from '../../../utils/permissions'
import prisma from '../../../utils/prisma'

/**
 * GET /api/admin/users/:id — full customer detail for the admin panel:
 * profile, balances, and the 10 most recent projects / transactions /
 * tickets plus total counts.
 *
 * Minimised by role (ADR-025, UK GDPR): the balances, the ledger rows and
 * project values go only to roles holding `money.view`, and date of birth
 * and gender only to roles holding `clients.approve`. What a role may not
 * see is left out of the response, not blanked in the page.
 */

export default defineEventHandler(async (event) => {
  const staff = await requireStaffPermission(event, 'work.view')
  const canMoney = can(staff.staffRole, 'money.view')
  const canPersonal = can(staff.staffRole, 'clients.approve')

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
      status: true,
      verifiedAt: true,
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
      company: true,
      twoFactor: { select: { enabledAt: true } },
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

  const { walletBalance, adCredits, transactions, birthDate, gender, projects, ...rest } = user
  return {
    ...rest,
    projects: projects.map(p => ({ ...p, amount: canMoney ? p.amount : null })),
    ...(canMoney ? { walletBalance, adCredits, transactions } : { walletBalance: null, adCredits: null, transactions: [] }),
    ...(canPersonal ? { birthDate, gender } : {}),
    canMoney,
  }
})
