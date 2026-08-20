<script setup lang="ts">
/**
 * Mobile tab bar — the primary navigation below `md` (V2 Phase 9).
 *
 * The product has five destinations. Reaching any of them through a drawer
 * costs a tap every time, which is the wrong trade at that count, so they get
 * a permanent bar and the drawer keeps only what the bar cannot hold (the
 * account menu and the Services sub-items).
 *
 * "New order" sits centre as the primary create action, raised out of the bar
 * the way a create affordance usually is.
 *
 * Hidden from `md` up, where the sidebar is the navigation. Also hidden inside
 * the New Order wizard: a checkout should not offer five ways to leave it —
 * see `suppressed` below.
 */
const route = useRoute()

interface Tab {
  label: string
  icon: string
  to: string
  primary?: boolean
}

const TABS: Tab[] = [
  { label: 'Home', icon: 'solar:widget-2-linear', to: '/dashboards/balance' },
  { label: 'Orders', icon: 'solar:clipboard-list-linear', to: '/dashboards/orders' },
  { label: 'Order', icon: 'lucide:plus', to: '/dashboards/services', primary: true },
  { label: 'Wallet', icon: 'solar:wallet-2-linear', to: '/dashboards/wallet' },
  { label: 'Support', icon: 'solar:headphones-round-linear', to: '/dashboards/support' },
]

/**
 * The wizard owns the whole screen while a customer is committing to a
 * purchase; the sticky total bar is the only chrome it should carry.
 */
const suppressed = computed(() => route.path.startsWith('/dashboards/services'))

/**
 * Longest-prefix match, so a detail route keeps its tab lit — the same rule
 * `ApexSidebarNav` uses, kept identical on purpose.
 */
const activeTo = computed(() => {
  let best = ''
  for (const tab of TABS) {
    const hit = route.path === tab.to || route.path.startsWith(`${tab.to}/`)
    if (hit && tab.to.length > best.length) {
      best = tab.to
    }
  }
  return best
})
</script>

<template>
  <!--
    `pb` carries the home-indicator inset so the row never sits under it, and
    the matching spacer at the end of the layout keeps page content from
    scrolling to a stop underneath the bar.
  -->
  <nav
    v-if="!suppressed"
    aria-label="Primary"
    class="border-muted-200 dark:border-muted-800 bg-white/95 dark:bg-muted-950/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
  >
    <ul class="flex items-stretch justify-around">
      <li v-for="tab in TABS" :key="tab.to" class="flex-1">
        <NuxtLink
          :to="tab.to"
          :aria-current="activeTo === tab.to ? 'page' : undefined"
          class="apex-focus flex h-[52px] w-full flex-col items-center justify-center gap-1 rounded-lg transition-colors"
          :class="tab.primary
            ? 'text-primary-600 dark:text-primary-400'
            : activeTo === tab.to
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-muted-500 dark:text-muted-400'"
        >
          <span
            v-if="tab.primary"
            class="bg-primary-500 -mt-4 inline-flex size-11 items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(125,83,242,0.35)]"
          >
            <Icon :name="tab.icon" class="size-5" />
          </span>
          <Icon v-else :name="tab.icon" class="size-[21px]" />
          <span class="text-[10px] font-semibold leading-none" :class="tab.primary ? '-mt-0.5' : ''">{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>

  <!--
    Spacer, not padding on the page wrapper: every page would otherwise have to
    remember it, and the one that forgot would hide its own last row behind the
    bar. 52px bar + the inset.
  -->
  <div v-if="!suppressed" aria-hidden="true" class="h-[calc(52px+env(safe-area-inset-bottom))] md:hidden" />
</template>
