// export default defineAppConfig({
//   tairo: {
//     title: 'Apex Digital', // نام پنل شما

//     sidebar: {
//       // تنظیمات تولبار بالای موبایل
//       toolbar: {
//         showNavBurger: true,
//         tools: [
//           { component: 'ThemeToggle' },
//           { component: 'LanguageDropdown' },
//         ],
//       },
      
//       // تنظیمات نویگیشن
//       navigation: {
//         enabled: true,
//         startOpen: true,
//         logo: {
//           component: 'Logo',
//           resolve: true,
//         },
//         // آرایه آیتم‌های منو
//         items: [
//           // 1. DASHBOARD (لینک مستقیم در بالا)
//           {
//             title: 'Dashboard',
//             to: '/',
//             icon: 'lucide:layout-grid',
//             exact: true,
//           },

//           // DIVIDER
//           { divider: true, title: 'Business' },

//           // 2. BUSINESS GROUP
//           {
//             title: 'Operations', // عنوان گروه
//             icon: 'lucide:briefcase', // آیکون گروه
//             item: [
//               {
//                 title: 'New Order',
//                 to: '/orders/new',
//                 icon: 'lucide:sparkles',
//                 tag: 'HOT', // بج جذاب
//                 tagColor: 'primary',
//               },
//               {
//                 title: 'Active Projects',
//                 to: '/projects',
//                 icon: 'lucide:layers',
//                 badge: 4, // تعداد پروژه‌ها
//               },
//               {
//                 title: 'Service Catalog',
//                 to: '/services',
//                 icon: 'lucide:store',
//               },
//             ],
//           },

//           // DIVIDER
//           { divider: true, title: 'Finance' },

//           // 3. FINANCE GROUP
//           {
//             title: 'Financials',
//             icon: 'lucide:wallet-cards',
//             item: [
//               {
//                 title: 'My Wallet',
//                 to: '/finance/wallet',
//                 icon: 'lucide:wallet',
//               },
//               {
//                 title: 'Transactions',
//                 to: '/finance/transactions',
//                 icon: 'lucide:banknote',
//               },
//             ],
//           },

//           // DIVIDER
//           { divider: true },

//           // 4. SETTINGS (لینک‌های تکی پایین)
//           {
//             title: 'Settings',
//             to: '/settings',
//             icon: 'lucide:settings-2',
//           },
//           {
//             title: 'Support',
//             to: '/support',
//             icon: 'lucide:life-buoy',
//           },
//         ],
//       },
//     },
//   },
// })




export default defineAppConfig({
  tairo: {
    title: 'Apex Digital', // نام پنل شما

    sidebar: {
      toolbar: {
        showNavBurger: true,
        tools: [
          { component: 'ThemeToggle' },
          { component: 'LanguageDropdown' },
        ],
      },
      
      navigation: {
        enabled: true,
        startOpen: true,
        logo: {
          component: 'Logo',
          resolve: true,
        },
        // چیدمان منو بر اساس صفحات موجود
        items: [
          // 1. DASHBOARD (balance.vue)
          {
            title: 'Dashboard',
            to: '/', // فرض بر این است که balance.vue همان صفحه اصلی است
            icon: 'lucide:layout-grid',
            exact: true,
          },

          // جداکننده
          { divider: true, title: 'Business' },

          // 2. OPERATIONS (Orders & Services)
          {
            title: 'Operations',
            icon: 'lucide:briefcase',
            item: [
              {
                title: 'New Order',
                to: '/orders', // اشاره به پوشه orders
                icon: 'lucide:sparkles',
                tag: 'HOT',
                tagColor: 'primary',
              },
              {
                title: 'Services',
                to: '/services', // اشاره به پوشه services
                icon: 'lucide:store',
              },
            ],
          },

          // جداکننده
          { divider: true, title: 'Finance' },

          // 3. FINANCE (Wallet)
          {
            title: 'My Wallet', // اشاره به صفحه wallet
            to: '/wallet',
            icon: 'lucide:wallet',
          },

          // جداکننده
          { divider: true },

          // 4. ACCOUNT (Settings & Support)
          {
            title: 'Account',
            icon: 'lucide:user',
            item: [
              {
                title: 'Settings',
                to: '/settings', // اشاره به صفحه settings
                icon: 'lucide:settings-2',
              },
              {
                title: 'Support',
                to: '/support', // اشاره به صفحه support
                icon: 'lucide:life-buoy',
              },
            ],
          },
        ],
      },
    },
  },
})