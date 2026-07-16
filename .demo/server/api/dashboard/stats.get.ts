import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import prisma from '../../utils/prisma'

const ACTIVE_STATUSES = ['IN_PROGRESS', 'PENDING']

function mapStatus(status: string) {
  switch (status) {
    case 'IN_PROGRESS': return 'In Progress'
    case 'COMPLETED': return 'Completed'
    case 'CANCELLED': return 'Cancelled'
    default: return 'Pending'
  }
}

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const userId = session.id

  // Fetch everything in parallel for speed.
  const [user, activeProjects, recentProjects, spent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true, adCredits: true },
    }),
    prisma.project.count({
      where: { userId, status: { in: ACTIVE_STATUSES } },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      // NOTE: Project has no `client` field — that select was the source of the
      // PrismaClientValidationError. We use `category` as the secondary label.
      select: {
        id: true,
        name: true,
        category: true,
        status: true,
        progress: true,
        amount: true,
        deadline: true,
        updatedAt: true,
      },
    }),
    prisma.transaction.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ])

  // Raw numbers only — formatting (GBP) happens in the UI via useCurrency().
  return {
    stats: {
      activeProjects,
      walletBalance: user?.walletBalance ?? 0,
      adCredits: user?.adCredits ?? 0,
      totalSpent: Math.abs(spent._sum.amount ?? 0),
    },
    projects: recentProjects.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category || 'General',
      status: mapStatus(p.status),
      progress: p.progress ?? 0,
      amount: p.amount ?? 0,
      deadline: p.deadline ? new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null,
      icon: (p.category || '').toLowerCase().includes('seo')
        ? 'lucide:bar-chart-3'
        : (p.category || '').toLowerCase().includes('market')
            ? 'lucide:megaphone'
            : 'lucide:box',
    })),
  }
})
