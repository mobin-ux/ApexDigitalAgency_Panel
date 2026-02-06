import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'اطلاعات ناقص است' })
  }

  // نکته: prisma اینجا به صورت خودکار توسط Nuxt ایمپورت شده است
  const user = await prisma.user.findUnique({ where: { email } })

  // ۱. چک کردن وجود کاربر
  if (!user || !user.password) {
    throw createError({ statusCode: 401, statusMessage: 'ایمیل یا رمز عبور اشتباه است' })
  }

  // ۲. چک کردن وضعیت مسدودی (Security Check) 🚫
  if (user.status === 'BANNED') {
    throw createError({ statusCode: 403, statusMessage: 'حساب کاربری شما مسدود شده است.' })
  }
  
  if (user.status === 'PENDING') {
    throw createError({ statusCode: 403, statusMessage: 'لطفاً ابتدا ایمیل خود را تایید کنید.' })
  }

  // ۳. چک کردن رمز
  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: 'ایمیل یا رمز عبور اشتباه است' })
  }

  // ۴. ساخت توکن با اطلاعات نقش (Role)
  const secret = process.env.JWT_SECRET || 'secret'
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role }, // نقش را هم در توکن گذاشتیم
    secret,
    { expiresIn: '7d' }
  )

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 604800,
    path: '/'
  })

  // ۵. حذف اطلاعات حساس از خروجی
  const { password: _, ...userInfo } = user
  return { status: 'success', user: userInfo }
})