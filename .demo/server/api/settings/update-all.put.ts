import { defineEventHandler, readBody, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  
  let userId
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
    userId = decoded.id
  } catch (e) {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }

  const body = await readBody(event)
  const user = body.user || {}
  const company = body.company || {}

  // 1. Update User Profile (Safe Checks)
  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: user.firstName,
      lastName: user.lastName,
      // email: user.email, // ایمیل را فعلا آپدیت نکنیم تا لاگین خراب نشود
      phone: user.phone,
      bio: user.bio,
      gender: user.gender,
      avatar: user.avatar,
      coverImage: user.coverImage,
      // ذخیره آدرس به صورت JSON یا فیلدهای ساده
      city: user.mailingAddress?.city || null,
      country: user.mailingAddress?.country || null,
    }
  })

  // 2. Upsert Company
  await prisma.company.upsert({
    where: { userId: userId },
    update: {
      name: company.name || '',
      email: company.email,
      website: company.website,
      phone: company.phone,
      taxId: company.taxId,
      type: company.type,
      income: company.income,
      employees: company.employees,
      manager: company.manager,
      status: company.status,
      notes: company.notes,
      logo: company.logo
    },
    create: {
      userId: userId,
      name: company.name || 'My Company',
      email: company.email,
      website: company.website,
      phone: company.phone,
      type: company.type,
      status: 'Active'
    }
  })

  return { status: 'success', message: 'Settings saved successfully' }
})