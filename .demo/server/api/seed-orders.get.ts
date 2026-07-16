import process from 'node:process'
import { PrismaClient } from '@prisma/client'
import { createError, defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // Dev-only seed/bootstrap endpoint — must never exist in a production build.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
  const token = getCookie(event, 'auth_token')
  if (!token)
    return 'Login first'
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  // 1. پاک کردن پروژه‌های قبلی (اختیاری - برای تمیز بودن تست)
  await prisma.project.deleteMany({ where: { userId } })

  // 2. ساخت پروژه طراحی سایت (در حال انجام)
  await prisma.project.create({
    data: {
      userId,
      name: 'E-Commerce Redesign',
      category: 'Web Development',
      status: 'IN_PROGRESS',
      amount: 2500,
      progress: 65, // 65% پیشرفت
      startDate: new Date(),
      deadline: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 روز بعد
      milestones: {
        create: [
          { title: 'Project Scoping', status: 'COMPLETED', date: new Date() },
          { title: 'Wireframing & UI', status: 'COMPLETED', date: new Date() },
          { title: 'Frontend Development', status: 'CURRENT', date: null }, // مرحله فعلی
          { title: 'Backend Integration', status: 'PENDING' },
          { title: 'Testing & QA', status: 'PENDING' },
        ],
      },
    },
  })

  // 3. ساخت پروژه سئو (تکمیل شده)
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
      files: { // <--- این بخش را اضافه کنید
        create: [
          { name: 'Project_Brief.pdf', size: '1.2 MB', type: 'pdf', url: '#' },
          { name: 'Design_Mockups_v1.zip', size: '14 MB', type: 'zip', url: '#' },
        ],
      },
    },
  })

  return 'Orders with Milestones seeded!'
})
