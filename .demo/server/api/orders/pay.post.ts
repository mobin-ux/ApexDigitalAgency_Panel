import { defineEventHandler, readBody, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  const body = await readBody(event)
  const { projectId } = body

  // 1. دریافت پروژه و کاربر
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!project || !user) throw createError({ statusCode: 404, message: 'Not found' })

  // 2. بررسی وضعیت پرداخت
  // فرض می‌کنیم اگر پروژه PENDING باشد یعنی هنوز پرداخت نشده
  if (project.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: 'This project is already active or completed.' })
  }

  // 3. بررسی موجودی
  if (user.walletBalance < project.amount) {
    throw createError({ statusCode: 400, message: 'Insufficient wallet balance. Please deposit funds.' })
  }

  // 4. تراکنش اتمیک (کسر پول + فعال‌سازی پروژه)
  await prisma.$transaction([
    // کسر پول
    prisma.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: project.amount } }
    }),
    // تغییر وضعیت پروژه به فعال
    prisma.project.update({
      where: { id: projectId },
      data: { status: 'IN_PROGRESS', progress: 5 } // شروع با 5 درصد
    }),
    // ثبت تراکنش
    prisma.transaction.create({
      data: {
        userId,
        amount: -project.amount,
        type: 'PAYMENT',
        description: `Payment for project: ${project.name}`
      }
    })
  ])

  return { status: 'success', message: 'Project paid and activated!' }
})