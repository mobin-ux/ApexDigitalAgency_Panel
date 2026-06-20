export default defineAppConfig({
  tairo: {
    title: 'Apex Digi',

    sidebar: {
      toolbar: {
        showNavBurger: true,
        tools: [
          { component: 'ThemeToggle' },
          { component: 'LanguageDropdown' },
        ],
      },

      // NOTE: the live customer navigation is defined in the `sidenav` layout
      // (layouts/sidenav.vue), which is the layout every dashboard page uses.
      // This config is kept aligned with it so any sidebar-style layout that
      // reads app.config resolves to the same, valid routes.
      navigation: {
        enabled: true,
        startOpen: true,
        logo: {
          component: 'Logo',
          resolve: true,
        },
        items: [
          {
            title: 'Dashboard',
            to: '/dashboards/balance',
            icon: 'lucide:layout-grid',
            exact: true,
          },

          { divider: true, title: 'Business' },

          {
            title: 'Operations',
            icon: 'lucide:briefcase',
            item: [
              {
                title: 'New Order',
                to: '/dashboards/services',
                icon: 'lucide:sparkles',
                tag: 'HOT',
                tagColor: 'primary',
              },
              {
                title: 'My Orders',
                to: '/dashboards/orders',
                icon: 'lucide:layers',
              },
            ],
          },

          { divider: true, title: 'Finance' },

          {
            title: 'Wallet & Credit',
            to: '/dashboards/wallet',
            icon: 'lucide:wallet',
          },

          { divider: true },

          {
            title: 'Account',
            icon: 'lucide:user',
            item: [
              {
                title: 'Settings',
                to: '/dashboards/settings',
                icon: 'lucide:settings-2',
              },
              {
                title: 'Support',
                to: '/dashboards/support',
                icon: 'lucide:life-buoy',
              },
            ],
          },
        ],
      },
    },
  },
})
