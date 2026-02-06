import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  // اینجا بعداً به دیتابیس واقعی (Prisma) وصل می‌شویم
  // فعلاً ساختار داده‌ای که فرانت‌‌اندِ ۶۱۹ خطی شما نیاز دارد را شبیه‌سازی می‌کنیم
  
  return {
    stats: [
      { label: 'Active Projects', value: '4', icon: 'lucide:layers', color: 'text-orange-400', bg: 'bg-orange-500/10' },
      { label: 'Available Credit', value: '$12,500', icon: 'lucide:credit-card', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { label: 'Cash Wallet', value: '$3,420', icon: 'lucide:wallet', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    ],
    projects: [
      {
        id: 1,
        name: 'E-Commerce Redesign',
        client: 'Gold Store Isfahan',
        status: 'In Progress',
        date: 'Due Jan 20',
        icon: 'lucide:shopping-bag',
      },
      {
        id: 2,
        name: 'Instagram Campaign',
        client: 'Apex Vision',
        status: 'Pending',
        date: 'Due Jan 15',
        icon: 'lucide:camera',
      },
      {
        id: 3,
        name: 'SEO Optimization',
        client: 'Tech Startup',
        status: 'Started',
        date: 'Due Feb 01',
        icon: 'lucide:search',
      }
    ]
  }
})