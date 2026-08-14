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

// Maintenance banner — driven by the admin Setting general.maintenance-mode
// via /api/config (Nuxt dedupes this useFetch with the per-page calls).
const { data: appConfig } = useFetch('/api/config', { lazy: true })
const maintenanceMode = computed(() => (appConfig.value as any)?.maintenanceMode === true)
</script>

<template>
  <TairoSidenavLayout v-slot="{ toggleMobileNav }">
    <TairoSidenavSidebar>
      <TairoSidenavSidebarHeader>
        <NuxtLink to="/dashboards/balance">
          <TairoLogoText class="text-primary-500 h-6 w-auto" />
        </NuxtLink>
      </TairoSidenavSidebarHeader>
      <TairoSidenavSidebarLinks class="p-4 grow apex-nav">
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

      <TairoSidenavSidebarLinks class="p-4 shrink-0 apex-nav">
        <TairoSidenavSidebarDivider />
        <!-- Admin accounts get a shortcut into the management panel. -->
        <TairoSidenavSidebarLink
          v-if="user?.role === 'ADMIN'"
          icon="solar:shield-user-linear"
          label="Admin panel"
          to="/admin"
        />
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
        <div v-if="maintenanceMode" role="status" class="mb-5 flex items-start gap-3 rounded-[14px] border border-[#D9A521]/30 bg-[#D9A521]/10 px-4 py-3 text-[13px] leading-[1.5] text-[#F2C14E]">
          <Icon name="lucide:hard-hat" class="mt-0.5 size-4 shrink-0" />
          <span><strong>Scheduled maintenance in progress.</strong> Some actions may be briefly unavailable — your data and payments are safe.</span>
        </div>
        <slot />
      </div>
    </TairoSidenavContent>
  </TairoSidenavLayout>
</template>

<style scoped>
/*
 * Touch sizing for the mobile drawer.
 *
 * The Tairo layer styles every nav row as `px-2.5 py-1.5` — 32px tall. That is
 * fine for the permanent rail at xl+, which is only ever driven by a pointer,
 * but below xl the same markup is the full-screen drawer and every row is a
 * finger target. 32px is under both the Apple (44pt) and Material (48dp)
 * minimums, and these are the app's primary navigation.
 *
 * Overridden here rather than in the layer so the shared template stays
 * untouched, and scoped to the drawer breakpoint so desktop density is kept.
 */
@media (max-width: 1279px) {
  .apex-nav :deep(a),
  .apex-nav :deep(button) {
    padding-top: 0.6rem;
    padding-bottom: 0.6rem;
  }
}
</style>
