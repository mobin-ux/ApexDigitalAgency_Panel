<script setup lang="ts">
const { user, logout } = useUser()

/**
 * Primary customer navigation.
 * Routes intentionally point at the real pages under /dashboards/*.
 */
const menu = [
  {
    label: 'Dashboard',
    icon: 'solar:widget-2-linear',
    to: '/dashboards/balance',
  },
  {
    label: 'Services',
    icon: 'solar:suitcase-linear',
    children: [
      {
        label: 'New Order',
        to: '/dashboards/services',
      },
      {
        label: 'My Orders',
        to: '/dashboards/orders',
      },
    ],
  },
  {
    label: 'Wallet & Credit',
    icon: 'solar:wallet-2-linear',
    to: '/dashboards/wallet',
  },
  {
    label: 'Support',
    icon: 'solar:headphones-round-linear',
    to: '/dashboards/support',
  },
  {
    label: 'Settings',
    icon: 'solar:settings-linear',
    to: '/dashboards/settings',
  },
]

const displayName = computed(() => {
  const u = user.value
  if (!u)
    return 'My Account'
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return full || u.email || 'My Account'
})

const avatarSrc = computed(() => user.value?.avatar || '/img/avatars/10.svg')
</script>

<template>
  <TairoSidenavLayout v-slot="{ toggleMobileNav }">
    <TairoSidenavSidebar>
      <TairoSidenavSidebarHeader>
        <NuxtLink to="/dashboards/balance">
          <TairoLogoText class="text-primary-500 h-6 w-auto" />
        </NuxtLink>
      </TairoSidenavSidebarHeader>
      <TairoSidenavSidebarLinks class="p-4 grow">
        <template v-for="item in menu" :key="item.label">
          <TairoSidenavSidebarLink
            v-if="!item.children"
            :to="item.to"
            :icon="item.icon"
            :label="item.label"
          />
          <TairoSidenavCollapsible
            v-else
            :default-open="item.children.some((child) => child.to === $route.path) || undefined"
          >
            <template #trigger>
              <TairoSidenavCollapsibleTrigger :icon="item.icon" :label="item.label" />
            </template>
            <TairoSidenavCollapsibleLink
              v-for="child in item.children"
              :key="child.label"
              :to="child.to"
              :label="child.label"
            />
          </TairoSidenavCollapsible>
        </template>
      </TairoSidenavSidebarLinks>

      <TairoSidenavSidebarLinks class="p-4 shrink-0">
        <TairoSidenavSidebarDivider />
        <TairoSidenavSidebarLink to="/dashboards/settings">
          <BaseAvatar size="xxs" :src="avatarSrc" />
          <span class="relative truncate">{{ displayName }}</span>
        </TairoSidenavSidebarLink>
        <TairoSidenavSidebarLink
          icon="solar:logout-2-linear"
          label="Sign out"
          @click="logout"
        />
      </TairoSidenavSidebarLinks>
    </TairoSidenavSidebar>
    <TairoSidenavContent class="min-h-screen">
      <div class="px-4 md:px-6 xl:px-8">
        <DemoToolbar @toggle-mobile-nav="toggleMobileNav" />
      </div>
      <slot />
    </TairoSidenavContent>
  </TairoSidenavLayout>
</template>
