import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs' // ایمپورت کردن پکیج رمزنگاری

const prisma = new PrismaClient()

async function main() {
  // ۱. پسورد را هش می‌کنیم (عدد ۱۰ میزان پیچیدگی است)
  const hashedPassword = await bcrypt.hash('123456', 10)

  // ۲. ساخت کاربر با پسورد
  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: hashedPassword // آپدیت پسورد اگر کاربر وجود داشت
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword, // ذخیره پسورد رمزنگاری شده
    },
  })

  console.log('✅ کاربر ادمین با رمز "123456" ساخته شد.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })