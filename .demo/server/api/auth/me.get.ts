import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')

  // اگر توکن نبود، یعنی کاربر لاگین نیست
  if (!token) {
    return { user: null }
  }

  try {
    const secret = process.env.JWT_SECRET || 'secret'
    const decoded = jwt.verify(token, secret) as any

    // دریافت اطلاعات تازه کاربر از دیتابیس
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        adCredits: true // اضافه شده طبق اسکیما جدید
      }
    })

    if (!user) return { user: null }

    return { user }
  } catch (error) {
    return { user: null }
  }
})