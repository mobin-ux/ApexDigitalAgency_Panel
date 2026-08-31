<script setup lang="ts">
import type { Permission } from '~~/shared/permissions'
import type { ApexNavItem } from '~/components/ApexSidebarNav.vue'

/**
 * Admin panel navigation. Same shell as the customer `sidenav` layout
 * (one product, one design language) with the management modules and a
 * violet ADMIN marker so it's always obvious which side you're on.
 *
 * Phase 9 groups the modules the way the design does — Work · People ·
 * Money · Service · System — and gates each row on the permission its
 * screens require. A row the signed-in role cannot open renders as a
 * padlock rather than a link that 403s: the point of the matrix is that
 * the panel tells you what your role covers before you click, not after.
 */
const { can, roleDef } = useStaffAccess()

interface AdminNavDef extends Omit<ApexNavItem, 'locked' | 'lockedReason'> {
  /** Permission this destination needs; omitted rows are open to all staff. */
  needs?: Permission
}

const groups: { heading: string, items: AdminNavDef[] }[] = [
  {
    heading: 'Work',
    items: [
      { label: 'Overview', icon: 'solar:widget-2-linear', to: '/admin', needs: 'work.view' },
      { label: 'Projects', icon: 'solar:suitcase-linear', to: '/admin/projects', needs: 'work.view' },
    ],
  },
  {
    heading: 'People',
    items: [
      { label: 'Clients', icon: 'solar:users-group-rounded-linear', to: '/admin/users', needs: 'work.view' },
      { label: 'Team & access', icon: 'solar:shield-user-linear', to: '/admin/team', needs: 'team.manage' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { label: 'Payments', icon: 'solar:wallet-2-linear', to: '/admin/payments', needs: 'money.view' },
      { label: 'Contracts', icon: 'solar:document-text-linear', to: '/admin/contracts', needs: 'money.view' },
    ],
  },
  {
    heading: 'Service',
    items: [
      { label: 'Support', icon: 'solar:headphones-round-linear', to: '/admin/tickets', needs: 'support.answer' },
      { label: 'Catalogue', icon: 'solar:box-linear', to: '/admin/services', needs: 'work.view' },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Platform settings', icon: 'solar:settings-linear', to: '/admin/settings', needs: 'platform.settings' },
      { label: 'Audit log', icon: 'solar:clock-circle-linear', to: '/admin/audit', needs: 'team.manage' },
      { label: 'Tools', icon: 'solar:tuning-2-linear', to: '/admin/tools', needs: 'catalogue.edit' },
    ],
  },
]

/**
 * Flattened for `ApexSidebarNav`: the heading rides on each group's first
 * row, which keeps the component's longest-prefix active match working
 * over one list of targets.
 */
const menu = computed<ApexNavItem[]>(() =>
  groups.flatMap(group =>
    group.items.map((item, index) => {
      const locked = Boolean(item.needs) && !can(item.needs!)
      return {
        label: item.label,
        icon: item.icon,
        to: item.to,
        ...(index === 0 ? { heading: group.heading } : {}),
        ...(locked
          ? {
              locked: true,
              lockedReason: `not available to ${roleDef.value?.label ?? 'your role'}`,
            }
          : {}),
      }
    }),
  ),
)
</script>

<template>
  <TairoSidenavLayout v-slot="{ toggleMobileNav }">
    <ApexShell>
      <TairoSidenavSidebar>
        <!-- Same brand band and drawer close affordance as the customer shell — see sidenav.vue. -->
        <div class="flex shrink-0 items-center gap-[11px] px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 lg:h-[76px] lg:px-5 lg:pb-0 lg:pt-0">
          <NuxtLink to="/admin" class="apex-focus flex min-w-0 items-center gap-[11px] rounded-lg">
            <img src="/brand/apex-icon.svg" alt="" class="size-[26px] shrink-0">
            <span class="font-heading text-muted-900 text-[22px] font-extrabold tracking-[-0.02em] dark:text-white">Apex</span>
            <span class="bg-primary-500/15 text-primary-600 dark:text-primary-400 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em]">ADMIN</span>
          </NuxtLink>
          <span class="grow" />
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
          <ApexAccountMenu panel="admin" />
        </div>
      </TairoSidenavSidebar>

      <TairoSidenavContent class="min-h-screen">
        <DemoToolbar @toggle-mobile-nav="toggleMobileNav" />
        <!-- Same shared gutter + safe-area handling as the customer shell (see sidenav.vue). -->
        <div class="pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] xl:pl-[max(2rem,env(safe-area-inset-left))] xl:pr-[max(2rem,env(safe-area-inset-right))]">
          <slot />
        </div>
      </TairoSidenavContent>
    </ApexShell>

    <!-- Panel search — see sidenav.vue. -->
    <ApexSearch />
  </TairoSidenavLayout>
</template>
