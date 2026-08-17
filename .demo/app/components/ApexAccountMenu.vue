<script setup lang="ts">
import { DemoPanelLanguage } from '#components'

/**
 * The single account entry point for both shells.
 *
 * Replaces four separate affordances: three stacked sidebar rows (panel
 * shortcut / name / sign out) and a fifth dropdown in the top bar that listed
 * Tairo demo destinations. One row, one menu, one place to look.
 *
 * Rows are `DropdownMenuItem as-child` rather than `BaseDropdownItem` because
 * that component wraps its slot in its own two-line title/text layout, which
 * cannot express "icon · label · trailing meta" on one 42px row.
 */
const { panel = 'customer' } = defineProps<{
  panel?: 'customer' | 'admin'
}>()

const { user, logout } = useUser()
const { open } = usePanels()
const { locale, locales } = useI18n()

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

const MENU_ROW
  = 'apex-focus flex min-h-[42px] w-full cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors'
// `as-child` merges reka's state onto the row itself, so the highlight variant
// targets the element directly (`data-[highlighted]`) rather than an ancestor.
const MENU_ROW_DEFAULT
  = 'text-muted-700 dark:text-muted-300 data-[highlighted]:bg-muted-100 dark:data-[highlighted]:bg-muted-700/50'
</script>

<template>
  <BaseDropdown
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
      <button
        type="button"
        aria-label="Open account menu"
        class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800/60 data-[state=open]:bg-muted-100 dark:data-[state=open]:bg-muted-800 flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors"
      >
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

    <DropdownMenuItem v-if="panel === 'admin'" as-child>
      <NuxtLink to="/dashboards/balance" :class="[MENU_ROW, MENU_ROW_DEFAULT]">
        <Icon name="lucide:layout-dashboard" class="text-muted-400 dark:text-muted-500 size-[17px] shrink-0" />
        <span class="grow">Customer dashboard</span>
      </NuxtLink>
    </DropdownMenuItem>
    <DropdownMenuItem v-else-if="user?.role === 'ADMIN'" as-child>
      <NuxtLink to="/admin" :class="[MENU_ROW, MENU_ROW_DEFAULT]">
        <Icon name="lucide:shield-check" class="text-muted-400 dark:text-muted-500 size-[17px] shrink-0" />
        <span class="grow">Admin panel</span>
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
