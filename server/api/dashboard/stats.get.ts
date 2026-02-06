import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client' // Ensure correct import if needed

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 1. Authenticate
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const secret = process.env.JWT_SECRET || 'secret'
  let userPayload
  try {
    userPayload = jwt.verify(token, secret) as any
  } catch (e) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Token' })
  }

  // 2. Fetch User Role from Database (Don't trust token blindly for permissions)
  const currentUser = await prisma.user.findUnique({
    where: { id: userPayload.id },
    select: { id: true, role: true }
  })

  if (!currentUser) throw createError({ statusCode: 401, statusMessage: 'User not found' })

  // 3. Define Logic Based on Role
  let stats = []
  let projects = []

  if (currentUser.role === 'ADMIN') {
    // --- ADMIN VIEW: See Everything ---
    
    const [totalUsers, totalProjects, totalRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.transaction.findMany({ where: { type: 'DEPOSIT' } }) // Simple revenue calc
    ])

    const revenue = totalRevenue.reduce((acc, t) => acc + t.amount, 0)

    stats = [
      { label: 'Total Users', value: totalUsers.toString(), icon: 'lucide:users', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { label: 'Total Projects', value: totalProjects.toString(), icon: 'lucide:briefcase', color: 'text-purple-400', bg: 'bg-purple-500/10' },
      { label: 'Total Revenue', value: `$${revenue.toLocaleString()}`, icon: 'lucide:dollar-sign', color: 'text-green-400', bg: 'bg-green-500/10' },
    ]

    // Admin sees the latest projects from ALL users
    projects = await prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } } // Include owner info
    })

  } else if (currentUser.role === 'EMPLOYEE') {
    // --- EMPLOYEE VIEW: See Assigned Projects ---

    const assignedCount = await prisma.project.count({
      where: { employeeId: currentUser.id }
    })

    stats = [
      { label: 'Assigned Tasks', value: assignedCount.toString(), icon: 'lucide:check-square', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    ]

    projects = await prisma.project.findMany({
      where: { employeeId: currentUser.id },
      take: 5,
      orderBy: { deadline: 'asc' },
      include: { user: { select: { email: true } } }
    })

  } else {
    // --- CUSTOMER VIEW: See Own Data ---

    const [activeCount, txs] = await Promise.all([
      prisma.project.count({ where: { userId: currentUser.id, status: { not: 'COMPLETED' } } }),
      prisma.transaction.findMany({ where: { userId: currentUser.id } })
    ])
    
    const balance = txs.reduce((acc, t) => acc + t.amount, 0)

    stats = [
      { label: 'Active Projects', value: activeCount.toString(), icon: 'lucide:layers', color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Wallet Balance', value: `$${balance.toLocaleString()}`, icon: 'lucide:wallet', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    ]

    projects = await prisma.project.findMany({
      where: { userId: currentUser.id },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })
  }

  // 4. Return Formatted Data
  return {
    role: currentUser.role,
    stats,
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      // If admin/employee, show who the client is
      client: 'user' in p ? (p.user as any).email : (p.client || 'Personal'),
      status: p.status,
      date: p.deadline ? new Date(p.deadline).toLocaleDateString() : 'No Deadline',
      icon: 'lucide:folder'
    }))
  }
})