import { defineEventHandler, getCookie, getQuery, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // 1. Auth Guard
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const secret = process.env.JWT_SECRET || 'secret'
  let userPayload
  try {
    userPayload = jwt.verify(token, secret) as any
  } catch (e) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Token' })
  }

  // 2. Parse Query Params (Standardization)
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const limit = Number(query.limit) || 10
  const skip = (page - 1) * limit
  const status = query.status as string
  const sort = query.sort as 'asc' | 'desc' || 'desc'

  // 3. Build Where Clause
  const whereClause: any = {
    userId: userPayload.id
  }

  // Map UI status 'active' to DB status 'IN_PROGRESS' if needed
  if (status && status !== 'All') {
    if (status === 'active') whereClause.status = 'IN_PROGRESS'
    else if (status === 'completed') whereClause.status = 'COMPLETED'
    else if (status === 'pending') whereClause.status = 'PENDING'
  }

  // 4. Execute Queries (Transaction for atomicity)
  const [total, orders] = await Promise.all([
    prisma.project.count({ where: whereClause }),
    prisma.project.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: sort }, // Dynamic Sorting
      include: {
        milestones: { // Load Milestones
          orderBy: { id: 'asc' } // Or by date
        } 
      }
    })
  ])

  // 5. Return Standard Response
  return {
    data: orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }
})
