import process from 'node:process'
import { PrismaClient } from '@prisma/client'
import { createError, defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 1. Auth Check
  const token = getCookie(event, 'auth_token')
  if (!token)
    throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  // 2. Fetch Projects with Milestones
  // نکته مهم: حتما باید include: { milestones } باشد
  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      milestones: { orderBy: { date: 'asc' } },
      files: true,
      manager: { select: { firstName: true, lastName: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 3. Return Raw Data
  // ما اینجا داده خام را برمی‌گردانیم، چون فرانت‌‌اند شما (Computed Property)
  // وظیفه تبدیل داده‌ها (Mapping) را بر عهده گرفته است.
  return {
    data: projects,
  }
})
