<script setup lang="ts">
const { user, logout } = useUser()

/**
 * Admin panel navigation. Same shell as the customer `sidenav` layout
 * (one product, one design language) with the management modules and a
 * violet ADMIN marker so it's always obvious which side you're on.
 */
const menu = [
  {
    label: 'Overview',
    icon: 'solar:widget-2-linear',
    to: '/admin',
  },
  {
    label: 'Users',
    icon: 'solar:users-group-rounded-linear',
    to: '/admin/users',
  },
  {
    label: 'Projects',
    icon: 'solar:suitcase-linear',
    to: '/admin/projects',
  },
  {
    label: 'Payments',
    icon: 'solar:wallet-2-linear',
    to: '/admin/payments',
  },
  {
    label: 'Tickets',
    icon: 'solar:headphones-round-linear',
    to: '/admin/tickets',
  },
  {
    label: 'Tools',
    icon: 'solar:tuning-2-linear',
    to: '/admin/tools',
  },
  {
    label: 'Settings',
    icon: 'solar:settings-linear',
    to: '/admin/settings',
  },
]

const displayName = computed(() => {
  const u = user.value
  if (!u)
    return 'Administrator'
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return full || u.email || 'Administrator'
})

const avatarSrc = computed(() => user.value?.avatar || '/img/avatars/10.svg')
</script>

<template>
  <TairoSidenavLayout v-slot="{ toggleMobileNav }">
    <TairoSidenavSidebar>
      <TairoSidenavSidebarHeader>
        <NuxtLink to="/admin" class="flex items-center gap-2.5">
          <TairoLogoText class="text-primary-500 h-6 w-auto" />
          <span class="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] text-primary-400">ADMIN</span>
        </NuxtLink>
      </TairoSidenavSidebarHeader>
      <TairoSidenavSidebarLinks class="p-4 grow">
        <TairoSidenavSidebarLink
          v-for="item in menu"
          :key="item.label"
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
        />
      </TairoSidenavSidebarLinks>

      <TairoSidenavSidebarLinks class="p-4 shrink-0">
        <TairoSidenavSidebarDivider />
        <TairoSidenavSidebarLink
          icon="solar:round-arrow-left-linear"
          label="Customer dashboard"
          to="/dashboards/balance"
        />
        <TairoSidenavSidebarLink to="/admin">
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
      <!-- Same shared gutter + safe-area handling as the customer shell (see sidenav.vue). -->
      <div class="pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] xl:pl-[max(2rem,env(safe-area-inset-left))] xl:pr-[max(2rem,env(safe-area-inset-right))]">
        <DemoToolbar @toggle-mobile-nav="toggleMobileNav" />
        <slot />
      </div>
    </TairoSidenavContent>
  </TairoSidenavLayout>
</template>
