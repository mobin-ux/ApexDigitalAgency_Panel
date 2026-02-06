import { defineEventHandler } from 'h3'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // 1. Create Admin
    const adminPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.upsert({
      where: { email: 'admin@apex.com' },
      update: {},
      create: {
        email: 'admin@apex.com',
        password: adminPassword,
        firstName: 'Super',  // <--- Changed from name
        lastName: 'Admin',   // <--- Changed from name
        role: 'ADMIN',
        // status field might have been removed or defaults to something, checking schema...
        // If you removed 'status' from schema, remove it here too.
        // Assuming 'role' defaults exist.
      }
    })

    // 2. Create Customer
    const userPassword = await bcrypt.hash('user123', 10)
    const user = await prisma.user.upsert({
      where: { email: 'user@apex.com' },
      update: {},
      create: {
        email: 'user@apex.com',
        password: userPassword,
        firstName: 'John',   // <--- Changed from name
        lastName: 'Doe',     // <--- Changed from name
        role: 'CUSTOMER',
      }
    })

    // 3. Create Sample Project (Safe Check)
    // Check if project exists first to avoid duplicates on re-run
    const existingProject = await prisma.project.findFirst({ where: { userId: user.id } })
    
    if (!existingProject) {
      await prisma.project.create({
        data: {
          name: 'User Project 1',
          userId: user.id,
          status: 'IN_PROGRESS',
          amount: 1000
        }
      })
    }

    return { 
      status: 'success',
      message: 'Database seeded successfully!', 
      users: {
        admin: 'admin@apex.com / admin123',
        customer: 'user@apex.com / user123'
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message, stack: error.stack }
  }
})