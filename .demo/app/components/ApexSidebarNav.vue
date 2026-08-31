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
 * Rows are 48px in the drawer and 44px on the desktop rail (Material 48dp /
 * Apple HIG 44pt): the drawer is finger-driven and has the vertical room, the
 * rail is pointer-driven and does not need it.
 */
export interface ApexNavChild {
  label: string
  to: string
  /** Shown only where the group is flattened into top-level rows — see below. */
  icon?: string
}

export interface ApexNavItem {
  label: string
  icon?: string
  to?: string
  children?: ApexNavChild[]
  /**
   * Section label rendered above this row, which starts a new group
   * (Phase 9 Admin: Work · People · Money · Service · System). Carried by
   * the group's first row rather than by a wrapper object so the
   * longest-prefix match below still sees one flat list of targets.
   */
  heading?: string
  /**
   * Rendered as a padlocked, non-interactive row instead of a link, for a
   * destination the signed-in staff member's role cannot open. A link
   * that 403s teaches people the panel is broken; a padlock tells them
   * the truth before they click (Phase 9 Admin §2).
   */
  locked?: boolean
  /** Why it is locked — becomes the row's accessible description. */
  lockedReason?: string
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
    item.children ? item.children.map(child => child.to) : (item.to && !item.locked ? [item.to] : []),
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
  = 'apex-focus group relative flex w-full min-h-12 items-center gap-3 rounded-xl px-[13px] py-2 text-[15px] transition-colors lg:min-h-11 lg:text-[14.5px]'
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
      <!--
        Group label. Sits inside the same flat list rather than wrapping its
        rows, so adding groups cannot change which row the active-path match
        picks. `gap` on the nav would double up here, hence the negative-free
        spacing via margin on the label itself.
      -->
      <div
        v-if="item.heading"
        class="text-muted-500 dark:text-muted-500 px-[13px] pb-2 pt-4 text-[10px] font-extrabold uppercase tracking-[0.08em] first:pt-0"
      >
        {{ item.heading }}
      </div>

      <!--
        Locked destination — a padlock, not a link. Rendered as a plain
        element with no tabindex: there is nothing to activate, and putting
        a focusable dead control in the tab order is the dead end Phases 5
        and 7 each removed.
      -->
      <div
        v-if="item.locked"
        :title="item.lockedReason"
        :aria-label="item.lockedReason ? `${item.label} — ${item.lockedReason}` : `${item.label} — not available to your role`"
        class="text-muted-400 dark:text-muted-500 font-medium cursor-default" :class="[ROW_BASE]"
      >
        <Icon v-if="item.icon" :name="item.icon" class="text-muted-300 dark:text-muted-600 size-5 shrink-0" />
        <span class="grow truncate">{{ item.label }}</span>
        <Icon name="lucide:lock" aria-hidden="true" class="text-muted-400 dark:text-muted-600 size-4 shrink-0" />
      </div>

      <!-- Leaf route -->
      <NuxtLink
        v-else-if="!item.children"
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
        Below `lg` the group flattens: its children become top-level rows and
        the accordion disappears. In a drawer an accordion charges a tap to
        reveal two links, and there is vertical room for both — so the tap buys
        nothing. Rendered as a sibling pair gated by `lg:` rather than by a
        media query in JS: both are visible on load, and picking between them in
        JavaScript is a hydration mismatch. `display: none` keeps the hidden
        half out of the accessibility tree, so only one set is ever announced.
      -->
      <template v-else>
        <NuxtLink
          v-for="child in item.children"
          :key="`flat-${child.label}`"
          :to="child.to"
          :aria-current="isActive(child.to) ? 'page' : undefined"
          class="lg:hidden" :class="[ROW_BASE, isActive(child.to) ? ROW_ACTIVE : ROW_IDLE]"
        >
          <Icon
            v-if="child.icon || item.icon"
            :name="child.icon || item.icon!"
            class="size-5 shrink-0"
            :class="isActive(child.to)
              ? 'text-muted-900 dark:text-white'
              : 'text-muted-400 dark:text-muted-500'"
          />
          <span class="truncate">{{ child.label }}</span>
        </NuxtLink>

        <!--
          Collapsible group — the rail's form of the same two links. Defaults
          open when one of its children is the current route, so a deep link
          never lands on a hidden active row.
        -->
        <CollapsibleRoot :default-open="isGroupActive(item) || undefined" class="group/collapsible hidden w-full lg:block">
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
    </template>
  </nav>
</template>
