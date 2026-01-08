export default defineAppConfig({
  tairo: {
    title: 'Apex Digital', // نام پنل شما

    sidebar: {
      // تنظیمات تولبار بالای موبایل
      toolbar: {
        showNavBurger: true,
        tools: [
          { component: 'ThemeToggle' },
          { component: 'LanguageDropdown' },
        ],
      },
      
      // تنظیمات نویگیشن
      navigation: {
        enabled: true,
        startOpen: true,
        logo: {
          component: 'Logo',
          resolve: true,
        },
        // آرایه آیتم‌های منو
        items: [
          // 1. DASHBOARD (لینک مستقیم در بالا)
          {
            title: 'Dashboard',
            to: '/',
            icon: 'lucide:layout-grid',
            exact: true,
          },

          // DIVIDER
          { divider: true, title: 'Business' },

          // 2. BUSINESS GROUP
          {
            title: 'Operations', // عنوان گروه
            icon: 'lucide:briefcase', // آیکون گروه
            item: [
              {
                title: 'New Order',
                to: '/orders/new',
                icon: 'lucide:sparkles',
                tag: 'HOT', // بج جذاب
                tagColor: 'primary',
              },
              {
                title: 'Active Projects',
                to: '/projects',
                icon: 'lucide:layers',
                badge: 4, // تعداد پروژه‌ها
              },
              {
                title: 'Service Catalog',
                to: '/services',
                icon: 'lucide:store',
              },
            ],
          },

          // DIVIDER
          { divider: true, title: 'Finance' },

          // 3. FINANCE GROUP
          {
            title: 'Financials',
            icon: 'lucide:wallet-cards',
            item: [
              {
                title: 'My Wallet',
                to: '/finance/wallet',
                icon: 'lucide:wallet',
              },
              {
                title: 'Transactions',
                to: '/finance/transactions',
                icon: 'lucide:banknote',
              },
            ],
          },

          // DIVIDER
          { divider: true },

          // 4. SETTINGS (لینک‌های تکی پایین)
          {
            title: 'Settings',
            to: '/settings',
            icon: 'lucide:settings-2',
          },
          {
            title: 'Support',
            to: '/support',
            icon: 'lucide:life-buoy',
          },
        ],
      },
    },
  },
})
