<script setup lang="ts">
import type { AdminCountKey } from '~/utils/adminNav'
import { ADMIN_NAV, navItemFor } from '~/utils/adminNav'

/**
 * The admin console's sidebar (`Admin Console.dc.html`): brand, six groups
 * of 34px rows, a live count where the row has one and a padlock where the
 * signed-in role cannot open the row. A locked row is still a link: it
 * opens the screen's access wall, which says which roles hold it — the
 * same sentence the API's 403 carries.
 *
 * Rendered twice by the layout (the fixed rail from `lg`, the drawer below
 * it), so it takes no state of its own beyond the route.
 */
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const { can, roleDef } = useStaffAccess()
// Read only: the layout owns the fetch, and this component renders twice.
const counts = useState<Partial<Record<AdminCountKey, number>>>('admin-nav-counts', () => ({}))

const current = computed(() => navItemFor(route.path)?.key ?? null)

const groups = computed(() => ADMIN_NAV.map(group => ({
  heading: group.heading,
  items: group.items.map((item) => {
    const locked = Boolean(item.needs) && !can(item.needs!)
    const count = !locked && item.count ? counts.value[item.count] ?? 0 : 0
    return { ...item, locked, count, current: current.value === item.key }
  }),
})))
</script>

<template>
  <div class="flex h-full flex-col">
    <NuxtLink to="/admin" class="apex-ring m-2 flex items-center gap-[11px] rounded-xl px-2.5 pb-3.5 pt-2.5" @click="emit('navigate')">
      <!-- The icon has an on-dark variant; swapping by class keeps SSR and the client in step. -->
      <img src="/brand/apex-icon-on-dark.svg" alt="" class="hidden size-[30px] shrink-0 dark:block">
      <img src="/brand/apex-icon.svg" alt="" class="size-[30px] shrink-0 dark:hidden">
      <span class="min-w-0">
        <span class="font-heading text-fg-heading block text-base font-extrabold tracking-[-0.01em]">Apex</span>
        <span class="text-fg-muted mt-px block text-[11px]">Admin console</span>
      </span>
    </NuxtLink>

    <nav aria-label="Admin" class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2.5 pb-3">
      <div v-for="group in groups" :key="group.heading || 'top'" class="flex flex-col gap-px">
        <div v-if="group.heading" class="text-fg-muted px-2.5 pb-1.5 pt-1 text-[10px] font-extrabold uppercase tracking-[0.09em]">
          {{ group.heading }}
        </div>
        <NuxtLink
          v-for="item in group.items"
          :key="item.key"
          :to="item.to"
          :aria-current="item.current ? 'page' : undefined"
          :title="item.locked ? `${item.label} is not part of the ${roleDef?.label ?? 'your'} role` : undefined"
          class="apex-ring flex h-[34px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors"
          :class="[
            item.current ? 'text-fg-heading apex-panel-nav-active font-semibold' : item.locked ? 'text-fg-muted font-medium opacity-70' : 'text-fg-body hover:bg-hover font-medium',
          ]"
          @click="emit('navigate')"
        >
          <Icon :name="item.icon" class="size-[18px] shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span v-if="item.count" class="bg-accent-tint text-accent-ink inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums">
            {{ item.count }}<span class="sr-only"> waiting</span>
          </span>
          <Icon v-if="item.locked" name="lucide:lock" class="text-fg-muted size-[13px] shrink-0" aria-label="Locked for your role" />
        </NuxtLink>
      </div>
    </nav>

    <!-- The design's actor row: the account menu's trigger is that row (avatar, name, role). -->
    <div class="border-line-subtle shrink-0 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <ApexAccountMenu panel="admin" />
    </div>
  </div>
</template>
