<script setup lang="ts">
import { DemoPanelLanguage } from '#components'

/**
 * The single account entry point for both shells.
 *
 * Replaces four separate affordances: three stacked sidebar rows (panel
 * shortcut / name / sign out) and a fifth dropdown in the top bar that listed
 * Tairo demo destinations. One row, one menu, one place to look.
 *
 * Two containers, one set of actions (V2 Phase 1 mobile, §5): a dropdown on the
 * desktop rail, a bottom sheet below `lg`. The trigger sits at the very bottom
 * of a full-height drawer, so a dropdown anchored to it would open against the
 * edge of the viewport and cover the identity it belongs to.
 *
 * Desktop rows are `DropdownMenuItem as-child` rather than `BaseDropdownItem`
 * because that component wraps its slot in its own two-line title/text layout,
 * which cannot express "icon · label · trailing meta" on one 42px row.
 */
const { panel = 'customer' } = defineProps<{
  panel?: 'customer' | 'admin'
}>()

const { user, logout } = useUser()
const { open } = usePanels()
const { locale, locales } = useI18n()

const isCompact = useIsCompact()
const sheetOpen = ref(false)

const displayName = computed(() => {
  const u = user.value
  if (!u) {
    return panel === 'admin' ? 'Administrator' : 'My Account'
  }
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return full || u.email || 'My Account'
})

/**
 * Initials, so a missing avatar can never render as a broken-image `?` again.
 *
 * The old fallback pointed at `/img/avatars/10.svg`, a Tairo demo asset that is
 * not guaranteed to exist in a deployed bundle — repointing it would only move
 * the failure. Text has no such failure mode.
 */
const initials = computed(() => {
  const u = user.value
  const source = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || ''
  return source
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]!.toUpperCase())
    .join('') || 'A'
})

const roleLabel = computed(() => (panel === 'admin' ? 'Admin account' : 'Client account'))
const settingsTo = computed(() => (panel === 'admin' ? '/admin/settings' : '/dashboards/settings'))

const currentLanguage = computed(() =>
  locales.value.find(item => item.code === locale.value)?.name ?? locale.value,
)

/** The panel switch: staff on the admin shell, or a customer whose own role is ADMIN. */
const showPanelSwitch = computed(() => panel === 'admin' || user.value?.role === 'ADMIN')
const switchTo = computed(() => (panel === 'admin' ? '/dashboards/balance' : '/admin'))
const switchLabel = computed(() => (panel === 'admin' ? 'Customer dashboard' : 'Admin panel'))
const switchIcon = computed(() => (panel === 'admin' ? 'lucide:layout-dashboard' : 'lucide:shield-check'))

/**
 * One trigger definition for both containers. The `lg:` values are the rail's;
 * the bare ones are the drawer's, where §5 asks for a 56px row.
 */
const TRIGGER
  = 'apex-focus hover:bg-muted-100 dark:hover:bg-muted-800/60 data-[state=open]:bg-muted-100 dark:data-[state=open]:bg-muted-800 flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors lg:min-h-0'

const MENU_ROW
  = 'apex-focus flex min-h-[42px] w-full cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors'
// `as-child` merges reka's state onto the row itself, so the highlight variant
// targets the element directly (`data-[highlighted]`) rather than an ancestor.
const MENU_ROW_DEFAULT
  = 'text-muted-700 dark:text-muted-300 data-[highlighted]:bg-muted-100 dark:data-[highlighted]:bg-muted-700/50'

/** 52px rows in the sheet, per §5 — a finger target, not a pointer one. */
const SHEET_ROW
  = 'apex-focus text-muted-700 dark:text-muted-200 hover:bg-muted-100 dark:hover:bg-muted-700/50 flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors'

function closeSheet() {
  sheetOpen.value = false
}
</script>

<template>
  <!--
    Below `lg`: the same row, opening a sheet. The trigger is written twice
    rather than shared because reka's dropdown owns its own trigger element and
    will not accept an external one; only ever one of the two is rendered, and
    both read from the same `TRIGGER` class list so they cannot drift apart.
  -->
  <template v-if="isCompact">
    <button
      type="button"
      aria-label="Open account menu"
      :aria-expanded="sheetOpen"
      :class="TRIGGER"
      @click="sheetOpen = true"
    >
      <BaseAvatar
        size="xs"
        :src="user?.avatar || undefined"
        :text="initials"
        class="bg-primary-500/15 text-primary-600 dark:text-primary-300 shrink-0 font-semibold"
      />
      <span class="min-w-0 grow text-start">
        <span class="text-muted-900 block truncate text-sm font-semibold leading-tight dark:text-white">
          {{ displayName }}
        </span>
        <span class="text-muted-500 block truncate text-xs">{{ roleLabel }}</span>
      </span>
      <Icon name="lucide:chevron-up" class="text-muted-400 dark:text-muted-500 size-4 shrink-0" />
    </button>

    <ApexBottomSheet
      v-model:open="sheetOpen"
      title="Account"
      description="Account settings, language, and sign out."
    >
      <template #header>
        <div class="border-muted-200 dark:border-muted-700 flex shrink-0 items-center gap-3 border-b px-4 pb-3.5 pt-3">
          <BaseAvatar
            size="sm"
            :src="user?.avatar || undefined"
            :text="initials"
            class="bg-primary-500/15 text-primary-600 dark:text-primary-300 shrink-0 font-semibold"
          />
          <span class="min-w-0 grow">
            <span class="text-muted-900 block truncate text-[15px] font-semibold dark:text-white">{{ displayName }}</span>
            <span class="text-muted-500 block truncate text-[12.5px]">{{ user?.email || roleLabel }}</span>
          </span>
        </div>
      </template>

      <div class="flex flex-col gap-0.5 p-2">
        <NuxtLink :to="settingsTo" :class="SHEET_ROW" @click="closeSheet">
          <Icon name="lucide:settings" class="text-muted-400 dark:text-muted-500 size-[19px] shrink-0" />
          <span class="grow">Account settings</span>
        </NuxtLink>

        <button type="button" :class="SHEET_ROW" @click="closeSheet(); open(DemoPanelLanguage)">
          <Icon name="lucide:globe" class="text-muted-400 dark:text-muted-500 size-[19px] shrink-0" />
          <span class="grow text-start">Language</span>
          <span class="text-muted-500 shrink-0 text-[13px]">{{ currentLanguage }}</span>
        </button>

        <NuxtLink v-if="showPanelSwitch" :to="switchTo" :class="SHEET_ROW" @click="closeSheet">
          <Icon :name="switchIcon" class="text-muted-400 dark:text-muted-500 size-[19px] shrink-0" />
          <span class="grow">{{ switchLabel }}</span>
        </NuxtLink>

        <!-- Destructive actions never sit adjacent to navigation. -->
        <div class="border-muted-200 dark:border-muted-700 my-1 border-t" />

        <button
          type="button"
          class="text-destructive-500 hover:bg-destructive-500/10 dark:text-destructive-500"
          :class="SHEET_ROW"
          @click="closeSheet(); logout()"
        >
          <Icon name="lucide:log-out" class="size-[19px] shrink-0" />
          <span class="grow text-start">Sign out</span>
        </button>
      </div>
    </ApexBottomSheet>
  </template>

  <BaseDropdown
    v-else
    variant="default"
    rounded="lg"
    :bindings="{
      content: {
        side: 'top',
        align: 'start',
        sideOffset: 8,
      },
    }"
    :classes="{ content: 'w-60 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5 space-y-0.5' }"
  >
    <template #button>
      <button type="button" aria-label="Open account menu" :class="TRIGGER">
        <BaseAvatar
          size="xs"
          :src="user?.avatar || undefined"
          :text="initials"
          class="bg-primary-500/15 text-primary-600 dark:text-primary-300 shrink-0 font-semibold"
        />
        <span class="min-w-0 grow text-start">
          <span class="text-muted-900 block truncate text-[13.5px] font-semibold leading-tight dark:text-white">
            {{ displayName }}
          </span>
          <span class="text-muted-500 block truncate text-[11.5px]">{{ roleLabel }}</span>
        </span>
        <Icon
          name="lucide:chevron-up"
          class="text-muted-400 dark:text-muted-500 size-4 shrink-0 transition-transform duration-200 in-data-[state=open]:rotate-180"
        />
      </button>
    </template>

    <DropdownMenuItem as-child>
      <NuxtLink :to="settingsTo" :class="[MENU_ROW, MENU_ROW_DEFAULT]">
        <Icon name="lucide:settings" class="text-muted-400 dark:text-muted-500 size-[17px] shrink-0" />
        <span class="grow">Account settings</span>
      </NuxtLink>
    </DropdownMenuItem>

    <!--
      Language moved here from the top bar. A UK-default product billing in GBP
      changes language rarely, so it does not warrant permanent top-level real
      estate — but all six locales still switch, through the same panel.
    -->
    <DropdownMenuItem as-child @select="open(DemoPanelLanguage)">
      <button type="button" :class="[MENU_ROW, MENU_ROW_DEFAULT]">
        <Icon name="lucide:globe" class="text-muted-400 dark:text-muted-500 size-[17px] shrink-0" />
        <span class="grow text-start">Language</span>
        <span class="text-muted-500 shrink-0 text-[11.5px]">{{ currentLanguage }}</span>
      </button>
    </DropdownMenuItem>

    <DropdownMenuItem v-if="showPanelSwitch" as-child>
      <NuxtLink :to="switchTo" :class="[MENU_ROW, MENU_ROW_DEFAULT]">
        <Icon :name="switchIcon" class="text-muted-400 dark:text-muted-500 size-[17px] shrink-0" />
        <span class="grow">{{ switchLabel }}</span>
      </NuxtLink>
    </DropdownMenuItem>

    <!-- Destructive actions never sit adjacent to navigation. -->
    <div class="border-muted-200 dark:border-muted-700 my-1 border-t" />

    <DropdownMenuItem as-child @select="logout()">
      <button type="button" class="text-destructive-500 data-[highlighted]:bg-destructive-500/10" :class="[MENU_ROW]">
        <Icon name="lucide:log-out" class="size-[17px] shrink-0" />
        <span class="grow text-start">Sign out</span>
      </button>
    </DropdownMenuItem>
  </BaseDropdown>
</template>
