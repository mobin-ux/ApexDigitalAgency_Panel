<script setup lang="ts">
import type { ApexNavItem } from '~/components/ApexSidebarNav.vue'

/**
 * Primary customer navigation.
 * Routes intentionally point at the real pages under /dashboards/*.
 *
 * Child icons matter below `lg`: the drawer flattens the Services group into
 * top-level rows, and a row with no icon in a column of rows that have one
 * reads as broken.
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
        icon: 'lucide:plus',
        to: '/dashboards/services',
      },
      {
        label: 'My orders',
        icon: 'solar:suitcase-linear',
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
    <ApexShell>
      <TairoSidenavSidebar>
        <!--
          76px brand block, so its bottom edge lines up with the top bar's
          divider and the two read as one band across the top of the app. In the
          drawer it is shorter and carries the close button, and it clears the
          notch — a drawer is `position: fixed` at the very top of the viewport,
          so nothing else can pad it away from one.
        -->
        <div class="flex shrink-0 items-center gap-[11px] px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 lg:h-[76px] lg:px-5 lg:pb-0 lg:pt-0">
          <NuxtLink to="/dashboards/balance" class="apex-focus flex items-center gap-[11px] rounded-lg">
            <img src="/brand/apex-icon.svg" alt="" class="size-[26px] shrink-0">
            <span class="font-heading text-muted-900 text-[22px] font-extrabold tracking-[-0.02em] dark:text-white">Apex</span>
          </NuxtLink>
          <span class="grow" />
          <!--
            The scrim and Escape both close the drawer, but neither is
            discoverable and neither is reachable by a switch or keyboard user
            who is already inside it. This is.
          -->
          <button
            type="button"
            aria-label="Close navigation menu"
            class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 text-muted-500 dark:text-muted-300 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
            @click="toggleMobileNav"
          >
            <Icon name="lucide:x" class="size-5" />
          </button>
        </div>

        <div class="nui-slimscroll grow overflow-y-auto px-3 pb-5">
          <ApexSidebarNav :items="menu" />
        </div>

        <!-- One account row, one menu — see ApexAccountMenu. -->
        <div class="border-muted-200 dark:border-muted-800 shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3">
          <ApexAccountMenu panel="customer" />
        </div>
      </TairoSidenavSidebar>

      <TairoSidenavContent class="min-h-screen">
        <!--
          The bar sits outside the gutter wrapper because below `lg` it is
          full-bleed, sticky and carries its own 6px padding; from `lg` up it
          re-applies the same gutter so its contents still line up with the
          content beneath it.
        -->
        <DemoToolbar @toggle-mobile-nav="toggleMobileNav" />

        <!--
          Shared horizontal gutter for every page's content. The
          `max(<gutter>, env(safe-area-inset-*))` pattern keeps the design's
          16/24/32px padding as the floor while also clearing the notch /
          rounded corners in landscape on modern iPhones. All are no-ops when
          the insets are 0 (every normal browser tab), so desktop and portrait
          are unchanged. Needs `viewport-fit=cover` (nuxt.config).
        -->
        <div class="pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] xl:pl-[max(2rem,env(safe-area-inset-left))] xl:pr-[max(2rem,env(safe-area-inset-right))]">
          <div v-if="maintenanceMode" role="status" class="border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-300 mb-8 flex items-start gap-3 rounded-2xl border px-4 py-3 text-[13px] leading-[1.5]">
            <Icon name="lucide:hard-hat" class="mt-0.5 size-4 shrink-0" />
            <span><strong>Scheduled maintenance in progress.</strong> Some actions may be briefly unavailable — your data and payments are safe.</span>
          </div>
          <slot />

          <!--
            Mobile primary navigation. Lives inside the padded wrapper so its
            spacer participates in the page's normal flow; the bar itself is
            fixed and carries the home-indicator inset. Hidden from `lg` up,
            where the sidebar is the navigation.
          -->
          <ApexBottomNav />
        </div>
      </TairoSidenavContent>
    </ApexShell>

    <!--
      Panel search, over the customer's own projects and tickets. Mounted per
      shell rather than in `app.vue` because it is the Apex panel's search, not
      the Tairo demo's — see the comment on `DemoAppSearch` there.
    -->
    <ApexSearch />
  </TairoSidenavLayout>
</template>
