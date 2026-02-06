import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { company: true }
  })

  if (!user) throw createError({ statusCode: 404 })

  return { user }
})