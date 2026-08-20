<script setup lang="ts">
/**
 * Mobile tab bar — the primary navigation below `md` (V2 Phase 9).
 *
 * The product has five destinations. Reaching any of them through a drawer
 * costs a tap every time, which is the wrong trade at that count, so they get
 * a permanent bar and the drawer keeps only what the bar cannot hold (the
 * account menu and the Services sub-items).
 *
 * Five equal tabs, flat — the design draws "Order" as a plus glyph in the same
 * row rather than a raised FAB. A raised centre button would sit over the page
 * content above it and needs its own dismiss affordance; the design does not
 * ask for one, and five even targets divide 393px cleanly.
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
}

const TABS: Tab[] = [
  { label: 'Home', icon: 'solar:widget-2-linear', to: '/dashboards/balance' },
  { label: 'Orders', icon: 'solar:suitcase-linear', to: '/dashboards/orders' },
  { label: 'Order', icon: 'lucide:plus', to: '/dashboards/services' },
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
    class="border-muted-200 dark:border-muted-800 dark:bg-muted-950/94 fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-0.5 border-t bg-white/94 px-1.5 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
  >
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-current="activeTo === tab.to ? 'page' : undefined"
      class="apex-focus flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-xl px-0.5 transition-colors"
      :class="activeTo === tab.to
        ? 'text-primary-600 dark:text-primary-400'
        : 'text-muted-500 dark:text-muted-400'"
    >
      <Icon :name="tab.icon" class="size-[21px] shrink-0" />
      <span
        class="whitespace-nowrap text-[10px] leading-none tracking-[-0.01em]"
        :class="activeTo === tab.to ? 'font-bold' : 'font-semibold'"
      >{{ tab.label }}</span>
    </NuxtLink>
  </nav>

  <!--
    Spacer, not padding on the page wrapper: every page would otherwise have to
    remember it, and the one that forgot would hide its own last row behind the
    bar. 52px bar + the inset.
  -->
  <div v-if="!suppressed" aria-hidden="true" class="h-[calc(52px+env(safe-area-inset-bottom))] md:hidden" />
</template>
