import { defineEventHandler, readBody, setCookie, createError } from 'h3'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }

  // 1. پیدا کردن کاربر
  const user = await prisma.user.findUnique({
    where: { email }
  })

  // اگر کاربر نبود
  if (!user) {
    throw createError({ statusCode: 401, message: 'User not found' })
  }

  // 2. چک کردن پسورد
  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    throw createError({ statusCode: 401, message: 'Invalid password' })
  }

  // 3. ساخت توکن
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  )

  // 4. تنظیم کوکی
  setCookie(event, 'auth_token', token, {
    httpOnly: false, // برای راحتی تست فعلا false
    secure: false,   // چون روی localhost هستیم
    maxAge: 60 * 60 * 24 * 7, // 7 روز
    path: '/'
  })

  // بازگرداندن اطلاعات کاربر (بدون پسورد)
  const { password: _, ...userWithoutPassword } = user
  return { status: 'success', user: userWithoutPassword, token }
})