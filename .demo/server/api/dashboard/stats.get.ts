import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) throw createError({ statusCode: 401 })
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any
  const userId = decoded.id

  // دریافت تمام اطلاعات به صورت موازی (برای سرعت بالا)
  const [user, card, activeProjects, recentProjects, transactions] = await Promise.all([
    // 1. اطلاعات کاربر (برای موجودی کیف پول)
    prisma.user.findUnique({ 
        where: { id: userId },
        select: { walletBalance: true } 
    }),

    // 2. اطلاعات کارت (برای سقف اعتبار)
    prisma.card.findFirst({ 
        where: { userId } 
    }),

    // 3. تعداد پروژه‌های فعال
    prisma.project.count({ 
        where: { userId, status: 'IN_PROGRESS' } 
    }),

    // 4. لیست پروژه‌های اخیر (برای نمایش در لیست)
    prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        client: true, // اگر کلاینت ندارید، نام کاربر را بگذارید
        status: true,
        updatedAt: true
      }
    }),

    // 5. محاسبه مجموع خرج‌کرد (تراکنش‌های منفی)
    prisma.transaction.aggregate({
      where: { userId, amount: { lt: 0 } }, // lt: less than 0 (برداشت‌ها)
      _sum: { amount: true }
    })
  ])

  // آماده‌سازی داده‌ها برای نمودارها
  const totalSpent = Math.abs(transactions._sum.amount || 0)
  const creditLimit = card?.paymentLimit || 0
  const walletBalance = user?.walletBalance || 0

  return {
    // آمار کارت‌های بالای صفحه
    stats: [
      { 
        label: 'Active Projects', 
        value: activeProjects, 
        icon: 'lucide:layers', 
        color: 'text-orange-400', 
        bg: 'bg-orange-500/10' 
      },
      { 
        label: 'Credit Limit', 
        value: creditLimit, 
        icon: 'lucide:credit-card', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10',
        formatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(creditLimit)
      },
      { 
        label: 'Cash Wallet', 
        value: walletBalance, 
        icon: 'lucide:wallet', 
        color: 'text-indigo-400', 
        bg: 'bg-indigo-500/10',
        formatted: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(walletBalance)
      },
    ],
    
    // لیست پروژه‌ها
    projects: recentProjects.map(p => ({
      id: p.id,
      name: p.name,
      client: p.client || 'Personal',
      status: p.status === 'IN_PROGRESS' ? 'In Progress' : (p.status === 'PENDING' ? 'Pending' : 'Completed'),
      date: new Date(p.updatedAt).toLocaleDateString(),
      icon: 'lucide:box' // آیکون پیش‌فرض
    })),

    // مجموع خرج‌کرد
    totalSpent: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSpent)
  }
})