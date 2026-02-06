import { defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // دریافت کاربر فعلی
  const token = getCookie(event, 'auth_token')
  if (!token) return { status: 'error', message: 'Login first' }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  // 1. ساخت پروژه Web Development (شبیه نمونه UI شما)
  await prisma.project.create({
    data: {
      name: 'E-Commerce Redesign',
      client: 'Gold Store',
      category: 'Web Development',
      status: 'IN_PROGRESS',
      progress: 65,
      amount: 5400,
      deadline: new Date('2026-02-15'),
      startDate: new Date('2025-12-01'),
      userId: userId,
      milestones: {
        create: [
          { title: 'Project Brief', status: 'COMPLETED', date: new Date('2025-12-01') },
          { title: 'Wireframing', status: 'COMPLETED', date: new Date('2025-12-10') },
          { title: 'UI Design', status: 'COMPLETED', date: new Date('2025-12-25') },
          { title: 'Frontend Dev', status: 'CURRENT' }, // در حال انجام
          { title: 'Backend Integration', status: 'PENDING' },
          { title: 'Final Review', status: 'PENDING' }
        ]
      }
    }
  })

  // 2. ساخت پروژه Branding
  await prisma.project.create({
    data: {
      name: 'Brand Identity V2',
      category: 'Branding',
      status: 'PENDING', // هنوز شروع نشده
      progress: 0,
      amount: 1500,
      deadline: new Date('2026-03-01'),
      userId: userId,
      milestones: {
        create: [
          { title: 'Discovery Call', status: 'PENDING' },
          { title: 'Logo Concepts', status: 'PENDING' }
        ]
      }
    }
  })

  return { message: 'Rich data seeded successfully!' }
})
