import { createError, defineEventHandler } from 'h3'
import { requireAuth } from '../utils/auth'
import prisma from '../utils/prisma'
import { syncProgress } from '../utils/project-lifecycle'

export default defineEventHandler(async (event) => {
  // Dev-only seed/bootstrap endpoint — must never exist in a production build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  // The signed-in account, through the same check as every other route (the
  // seeds used to verify the token with a fallback secret and 500'd, AUD-15).
  const decoded = requireAuth(event)
  const userId = decoded.id

  // 1. A web development project, like the one in the UI mockups
  await prisma.project.create({
    data: {
      name: 'E-Commerce Redesign',
      category: 'Web Development',
      status: 'IN_PROGRESS',
      progress: 65,
      amount: 5400,
      deadline: new Date('2026-02-15'),
      startDate: new Date('2025-12-01'),
      userId,
      milestones: {
        create: [
          { title: 'Project Brief', status: 'COMPLETED', date: new Date('2025-12-01') },
          { title: 'Wireframing', status: 'COMPLETED', date: new Date('2025-12-10') },
          { title: 'UI Design', status: 'COMPLETED', date: new Date('2025-12-25') },
          { title: 'Frontend Dev', status: 'CURRENT' }, // in progress
          { title: 'Backend Integration', status: 'PENDING' },
          { title: 'Final Review', status: 'PENDING' },
        ],
      },
    },
  })

  // 2. A branding project
  await prisma.project.create({
    data: {
      name: 'Brand Identity V2',
      category: 'Branding',
      status: 'PENDING', // not started yet
      progress: 0,
      amount: 1500,
      deadline: new Date('2026-03-01'),
      userId,
      milestones: {
        create: [
          { title: 'Discovery Call', status: 'PENDING' },
          { title: 'Logo Concepts', status: 'PENDING' },
        ],
      },
    },
  })

  // Progress follows each project's timeline, as everywhere else (AUD-05).
  for (const p of await prisma.project.findMany({ where: { userId }, select: { id: true } })) {
    await syncProgress(prisma, p.id)
  }

  return { message: 'Rich data seeded successfully!' }
})
