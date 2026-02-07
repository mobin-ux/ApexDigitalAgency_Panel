import { defineEventHandler, getCookie } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) return { status: 'error' }
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  // همه اعلان‌های این کاربر را خوانده شده کن
  await prisma.notification.updateMany({
    where: { userId: decoded.id, isRead: false },
    data: { isRead: true }
  })

  return { status: 'success' }
})