import bcrypt from 'bcryptjs'

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
        name: 'Super Admin',
        role: 'ADMIN',
        status: 'ACTIVE'
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
        name: 'John Customer',
        role: 'CUSTOMER',
        status: 'ACTIVE'
      }
    })

    // 3. Create Sample Project
    const project = await prisma.project.create({
      data: {
        name: 'User Project 1',
        userId: user.id,
        status: 'IN_PROGRESS',
        amount: 1000
      }
    })

    return { 
      status: 'success',
      message: 'Database seeded successfully!', 
      users: {
        admin: 'admin@apex.com / admin123',
        customer: 'user@apex.com / user123'
      }
    }
  } catch (error: any) {
    return { status: 'error', message: error.message }
  }
})
