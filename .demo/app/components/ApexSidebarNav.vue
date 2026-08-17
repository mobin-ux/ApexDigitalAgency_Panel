<script setup lang="ts">
/**
 * Primary sidebar navigation — shared by the customer and admin shells.
 *
 * Written at app level rather than as a `TairoSidenavSidebarLink` override
 * because Phase 1 changes the row's size, radius and active treatment, and the
 * layer expresses its active state through `exact-active-class` — a set of
 * utility class names that CSS cannot reliably re-target from the outside. The
 * layer stays untouched; this component owns the whole row.
 *
 * Rows are 44px at every breakpoint (Apple HIG 44pt / Material 48dp): the
 * drawer below `xl` is finger-driven, and the desktop rail loses nothing by
 * matching it.
 */
export interface ApexNavChild {
  label: string
  to: string
}

export interface ApexNavItem {
  label: string
  icon?: string
  to?: string
  children?: ApexNavChild[]
}

const { items } = defineProps<{
  items: ApexNavItem[]
}>()

const route = useRoute()

/**
 * Longest-prefix match, computed across the whole menu at once.
 *
 * A plain `route.path === to` leaves nothing highlighted on detail routes
 * (`/admin/users/<id>` had no active row at all), and a plain `startsWith`
 * lights up every ancestor — `/admin` would stay active on `/admin/users`.
 * Taking the longest matching prefix gives exactly one active row, always.
 */
const activePath = computed(() => {
  const targets = items.flatMap(item =>
    item.children ? item.children.map(child => child.to) : (item.to ? [item.to] : []),
  )

  let best = ''
  for (const to of targets) {
    const matches = route.path === to || route.path.startsWith(`${to}/`)
    if (matches && to.length > best.length) {
      best = to
    }
  }
  return best
})

function isActive(to?: string) {
  return Boolean(to) && activePath.value === to
}

function isGroupActive(item: ApexNavItem) {
  return item.children?.some(child => isActive(child.to)) ?? false
}

const ROW_BASE
  = 'apex-focus group relative flex w-full min-h-11 items-center gap-3 rounded-xl px-[13px] py-2 text-[14.5px] transition-colors'
const ROW_IDLE
  = 'font-medium text-muted-600 dark:text-muted-400 hover:bg-muted-100 hover:text-muted-900 dark:hover:bg-muted-800/60 dark:hover:text-white'
const ROW_ACTIVE
  = 'apex-nav-active font-semibold text-muted-900 dark:text-white'

const CHILD_BASE
  = 'apex-focus flex min-h-10 w-full items-center rounded-[10px] px-3 py-1.5 text-[13.5px] transition-colors'
const CHILD_IDLE
  = 'font-medium text-muted-600 dark:text-muted-400 hover:bg-muted-100 hover:text-muted-900 dark:hover:bg-muted-800/60 dark:hover:text-white'
const CHILD_ACTIVE
  = 'apex-nav-active font-semibold text-muted-900 dark:text-white'
</script>

<template>
  <nav aria-label="Primary" class="flex flex-col gap-[3px]">
    <template v-for="item in items" :key="item.label">
      <!-- Leaf route -->
      <NuxtLink
        v-if="!item.children"
        :to="item.to"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        :class="[ROW_BASE, isActive(item.to) ? ROW_ACTIVE : ROW_IDLE]"
      >
        <Icon
          v-if="item.icon"
          :name="item.icon"
          class="size-5 shrink-0"
          :class="isActive(item.to)
            ? 'text-muted-900 dark:text-white'
            : 'text-muted-400 dark:text-muted-500 group-hover:text-muted-700 dark:group-hover:text-muted-200'"
        />
        <span class="truncate">{{ item.label }}</span>
      </NuxtLink>

      <!--
        Collapsible group. Defaults open when one of its children is the
        current route, so a deep link never lands on a hidden active row.
      -->
      <CollapsibleRoot v-else :default-open="isGroupActive(item) || undefined" class="group/collapsible w-full">
        <CollapsibleTrigger class="cursor-pointer" :class="[ROW_BASE, ROW_IDLE]">
          <Icon
            v-if="item.icon"
            :name="item.icon"
            class="text-muted-400 dark:text-muted-500 group-hover:text-muted-700 dark:group-hover:text-muted-200 size-5 shrink-0"
          />
          <span class="grow truncate text-start">{{ item.label }}</span>
          <Icon
            name="lucide:chevron-down"
            class="text-muted-400 dark:text-muted-500 size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent class="w-full overflow-hidden">
          <!--
            The hairline rule replaces the layer's bullet dots: it groups the
            children into one visible unit at a glance, which floating dots do
            not, and costs no horizontal room.
          -->
          <div class="border-muted-200 dark:border-muted-800 my-[3px] ms-5 flex flex-col gap-0.5 border-s ps-3.5">
            <NuxtLink
              v-for="child in item.children"
              :key="child.label"
              :to="child.to"
              :aria-current="isActive(child.to) ? 'page' : undefined"
              :class="[CHILD_BASE, isActive(child.to) ? CHILD_ACTIVE : CHILD_IDLE]"
            >
              <span class="truncate">{{ child.label }}</span>
            </NuxtLink>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>
    </template>
  </nav>
</template>
