<script setup lang="ts">
import type { ApexNavItem } from '~/components/ApexSidebarNav.vue'

/**
 * Admin panel navigation. Same shell as the customer `sidenav` layout
 * (one product, one design language) with the management modules and a
 * violet ADMIN marker so it's always obvious which side you're on.
 */
const menu: ApexNavItem[] = [
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
    label: 'Services',
    icon: 'solar:box-linear',
    to: '/admin/services',
  },
  {
    label: 'Contracts',
    icon: 'solar:document-text-linear',
    to: '/admin/contracts',
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
</script>

<template>
  <TairoSidenavLayout v-slot="{ toggleMobileNav }">
    <TairoSidenavSidebar>
      <!-- Same 76px brand band as the customer shell — see sidenav.vue. -->
      <div class="flex h-[76px] shrink-0 items-center px-5">
        <NuxtLink to="/admin" class="apex-focus flex items-center gap-[11px] rounded-lg">
          <img src="/brand/apex-icon.svg" alt="" class="size-[26px] shrink-0">
          <span class="font-heading text-muted-900 text-[22px] font-extrabold tracking-[-0.02em] dark:text-white">Apex</span>
          <span class="bg-primary-500/15 text-primary-600 dark:text-primary-400 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em]">ADMIN</span>
        </NuxtLink>
      </div>

      <div class="nui-slimscroll grow overflow-y-auto px-3 pb-5">
        <ApexSidebarNav :items="menu" />
      </div>

      <!-- One account row, one menu — see ApexAccountMenu. -->
      <div class="border-muted-200 dark:border-muted-800 shrink-0 border-t p-3">
        <ApexAccountMenu panel="admin" />
      </div>
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
