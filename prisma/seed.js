import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10)

  // 1. ساخت مدیر کل (Admin)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: {
      email: 'admin@example.com',
      name: 'مدیر سیستم',
      password: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      avatar: '/img/avatars/1.svg' // آواتار پیش‌فرض
    },
  })
  console.log('✅ Admin user created:', admin.email)

  // 2. ساخت یک مشتری نمونه (User)
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: { role: 'USER', status: 'ACTIVE' },
    create: {
      email: 'client@example.com',
      name: 'مشتری نمونه',
      password: passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      avatar: '/img/avatars/2.svg'
    },
  })
  console.log('✅ Client user created:', client.email)
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })