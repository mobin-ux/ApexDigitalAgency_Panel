import prisma from '../../utils/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  // ۱. اعتبارسنجی ورودی
  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'ایمیل و رمز عبور الزامی است' })
  }

  // ۲. یافتن کاربر
  const user = await prisma.user.findUnique({ where: { email } })

  // ۳. بررسی امنیت: اگر کاربر نبود یا پسورد غلط بود، یک پیام کلی بده (برای جلوگیری از نشت اطلاعات)
  const isPasswordValid = user && user.password 
    ? await bcrypt.compare(password, user.password) 
    : false

  if (!user || !isPasswordValid) {
    throw createError({ statusCode: 401, statusMessage: 'اطلاعات ورود اشتباه است' })
  }

  // ۴. ساخت توکن (Payload minimal)
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is missing in .env')

  const token = jwt.sign(
    { id: user.id, email: user.email }, 
    secret, 
    { expiresIn: '7d' } // اعتبار ۷ روز
  )

  // ۵. تنظیم کوکی ایمن (HttpOnly)
  setCookie(event, 'auth_token', token, {
    httpOnly: true, // هکرها نمی‌توانند با JS به این دسترسی پیدا کنند (ضد XSS)
    secure: process.env.NODE_ENV === 'production', // در سرور واقعی فقط روی HTTPS کار کند
    sameSite: 'lax', // محافظت در برابر CSRF
    maxAge: 60 * 60 * 24 * 7, // ۷ روز (به ثانیه)
    path: '/'
  })

  // ۶. بازگشت اطلاعات (بدون پسورد)
  const { password: _, ...userInfo } = user
  return {
    status: 'success',
    user: userInfo
  }
})