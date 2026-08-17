<script setup lang="ts">
import type { ApexNavItem } from '~/components/ApexSidebarNav.vue'

/**
 * Primary customer navigation.
 * Routes intentionally point at the real pages under /dashboards/*.
 */
const menu: ApexNavItem[] = [
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
        label: 'New order',
        to: '/dashboards/services',
      },
      {
        label: 'My orders',
        to: '/dashboards/orders',
      },
    ],
  },
  {
    label: 'Wallet & credit',
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

// Maintenance banner — driven by the admin Setting general.maintenance-mode
// via /api/config (Nuxt dedupes this useFetch with the per-page calls).
const { data: appConfig } = useFetch('/api/config', { lazy: true })
const maintenanceMode = computed(() => (appConfig.value as any)?.maintenanceMode === true)
</script>

<template>
  <TairoSidenavLayout v-slot="{ toggleMobileNav }">
    <TairoSidenavSidebar>
      <!--
        76px brand block, so its bottom edge lines up with the top bar's divider
        and the two read as one band across the top of the app.
      -->
      <div class="flex h-[76px] shrink-0 items-center px-5">
        <NuxtLink to="/dashboards/balance" class="apex-focus flex items-center gap-[11px] rounded-lg">
          <img src="/brand/apex-icon.svg" alt="" class="size-[26px] shrink-0">
          <span class="font-heading text-muted-900 text-[22px] font-extrabold tracking-[-0.02em] dark:text-white">Apex</span>
        </NuxtLink>
      </div>

      <div class="nui-slimscroll grow overflow-y-auto px-3 pb-5">
        <ApexSidebarNav :items="menu" />
      </div>

      <!-- One account row, one menu — see ApexAccountMenu. -->
      <div class="border-muted-200 dark:border-muted-800 shrink-0 border-t p-3">
        <ApexAccountMenu panel="customer" />
      </div>
    </TairoSidenavSidebar>
    <TairoSidenavContent class="min-h-screen">
      <!--
        Shared horizontal gutter for the toolbar + every page's content. The
        `max(<gutter>, env(safe-area-inset-*))` pattern keeps the design's 16/24/32px
        padding as the floor while also clearing the notch / rounded corners in
        landscape on modern iPhones; the top safe-area inset clears the dynamic island at the
        top. All are no-ops when the insets are 0 (every normal browser tab), so
        desktop and portrait are unchanged. Needs `viewport-fit=cover` (nuxt.config).
      -->
      <div class="pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] xl:pl-[max(2rem,env(safe-area-inset-left))] xl:pr-[max(2rem,env(safe-area-inset-right))]">
        <DemoToolbar @toggle-mobile-nav="toggleMobileNav" />
        <div v-if="maintenanceMode" role="status" class="border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-300 mb-8 flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] leading-[1.5]">
          <Icon name="lucide:hard-hat" class="mt-0.5 size-4 shrink-0" />
          <span><strong>Scheduled maintenance in progress.</strong> Some actions may be briefly unavailable — your data and payments are safe.</span>
        </div>
        <slot />
      </div>
    </TairoSidenavContent>
  </TairoSidenavLayout>
</template>
