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

  // 1. Remove the account's previous projects, so a run starts clean
  await prisma.project.deleteMany({ where: { userId } })

  // 2. A website design project, in progress
  await prisma.project.create({
    data: {
      userId,
      name: 'E-Commerce Redesign',
      category: 'Web Development',
      status: 'IN_PROGRESS',
      amount: 2500,
      progress: 65,
      startDate: new Date(),
      deadline: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 days from now
      milestones: {
        create: [
          { title: 'Project Scoping', status: 'COMPLETED', date: new Date() },
          { title: 'Wireframing & UI', status: 'COMPLETED', date: new Date() },
          { title: 'Frontend Development', status: 'CURRENT', date: null }, // the current stage
          { title: 'Backend Integration', status: 'PENDING' },
          { title: 'Testing & QA', status: 'PENDING' },
        ],
      },
    },
  })

  // 3. An SEO project, completed
  await prisma.project.create({
    data: {
      userId,
      name: 'SEO Audit Q1',
      category: 'SEO Optimization',
      status: 'COMPLETED',
      amount: 800,
      progress: 100,
      milestones: {
        create: [
          { title: 'Keyword Research', status: 'COMPLETED', date: new Date() },
          { title: 'On-Page Optimization', status: 'COMPLETED', date: new Date() },
          { title: 'Report Generation', status: 'COMPLETED', date: new Date() },
        ],
      },
      files: {
        create: [
          { name: 'Project_Brief.pdf', size: '1.2 MB', type: 'pdf', url: '#' },
          { name: 'Design_Mockups_v1.zip', size: '14 MB', type: 'zip', url: '#' },
        ],
      },
    },
  })

  // Progress follows each project's timeline, as everywhere else (AUD-05).
  for (const p of await prisma.project.findMany({ where: { userId }, select: { id: true } })) {
    await syncProgress(prisma, p.id)
  }

  return 'Orders with Milestones seeded!'
})
