import prisma from '../../utils/prisma'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  // ۱. دریافت توکن از کوکی
  const token = getCookie(event, 'auth_token')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'لطفاً وارد شوید' })
  }

  try {
    // ۲. بررسی امضای توکن
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('Server config error')
    
    const decoded = jwt.verify(token, secret) as { id: number }

    // ۳. استعلام تازه از دیتابیس (Security Best Practice)
    // همیشه اطلاعات را دوباره از دیتابیس بگیرید، شاید نقش کاربر عوض شده باشد
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    })

    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'کاربر نامعتبر' })
    }

    // ۴. بازگشت اطلاعات امن
    const { password: _, ...userInfo } = user
    return {
      user: userInfo
    }

  } catch (error) {
    // اگر توکن منقضی یا دستکاری شده باشد، کوکی را پاک می‌کنیم
    deleteCookie(event, 'auth_token')
    throw createError({ statusCode: 401, statusMessage: 'نشست کاربری منقضی شده است' })
  }
})
