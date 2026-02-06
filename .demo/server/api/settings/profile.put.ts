import { defineEventHandler, readBody, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 1. Auth Check
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const secret = process.env.JWT_SECRET || 'secret'
  const decoded = jwt.verify(token, secret) as any

  // 2. Validate Body
  const body = await readBody(event)
  const { name, email } = body

  if (!email || !name) throw createError({ statusCode: 400, message: 'Name and Email are required' })

  // 3. Update User
  try {
    const updatedUser = await prisma.user.update({
      where: { id: decoded.id },
      data: { name, email }
    })
    
    // برگرداندن اطلاعات جدید (بدون پسورد)
    return { 
      status: 'success', 
      user: { 
        id: updatedUser.id, 
        name: updatedUser.name, 
        email: updatedUser.email, 
        role: updatedUser.role 
      } 
    }
  } catch (error) {
    // اگر ایمیل تکراری بود
    throw createError({ statusCode: 409, message: 'Email already in use' })
  }
})