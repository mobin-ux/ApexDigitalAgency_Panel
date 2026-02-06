import { defineEventHandler, readBody, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  const body = await readBody(event)
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) throw createError({ statusCode: 400, message: 'All fields are required' })
  if (newPassword.length < 6) throw createError({ statusCode: 400, message: 'Password too short' })

  // 1. Get User
  const user = await prisma.user.findUnique({ where: { id: decoded.id } })
  if (!user) throw createError({ statusCode: 404 })

  // 2. Verify Current Password
  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) throw createError({ statusCode: 403, message: 'Incorrect current password' })

  // 3. Hash New Password & Update
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: decoded.id },
    data: { password: hashedPassword }
  })

  return { status: 'success', message: 'Password updated successfully' }
})