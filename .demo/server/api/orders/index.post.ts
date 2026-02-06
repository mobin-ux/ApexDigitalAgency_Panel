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

  // 2. Validate Input
  const body = await readBody(event)
  const { title, category, description, budget } = body

  if (!title || !category) {
    throw createError({ statusCode: 400, message: 'Title and Category are required' })
  }

  // 3. Create Project with Default Milestones
  const newProject = await prisma.project.create({
    data: {
      name: title,
      category: category,
      description: description,
      amount: Number(budget) || 0,
      status: 'PENDING',
      progress: 0,
      startDate: new Date(),
      deadline: new Date(new Date().setDate(new Date().getDate() + 14)), // Default 2 weeks deadline
      userId: decoded.id,
      
      // Auto-generate milestones so the UI looks good immediately
      milestones: {
        create: [
          { title: 'Order Review', status: 'PENDING' },
          { title: 'Requirements', status: 'PENDING' },
          { title: 'Development', status: 'PENDING' },
          { title: 'Delivery', status: 'PENDING' }
        ]
      }
    }
  })

  return { status: 'success', project: newProject }
})
