import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) return { notifications: [] }
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  // گرفتن ۲۰ اعلان آخر
  const notifications = await prisma.notification.findMany({
    where: { userId: decoded.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  // شمارش خوانده نشده‌ها
  const unreadCount = await prisma.notification.count({
    where: { userId: decoded.id, isRead: false }
  })

  return { notifications, unreadCount }
})