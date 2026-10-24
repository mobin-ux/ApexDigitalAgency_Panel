<script setup lang="ts">
/**
 * Customer account menu (Panel v2): settings, theme, the admin switch for
 * staff, and sign out. A popover beside the sidebar row or the rail's avatar
 * from 768px; a bottom sheet on a phone, where it is also the way to Settings
 * (the five tabs leave it out).
 *
 * Plain links and buttons rather than `role="menu"`: a menu role promises
 * arrow-key navigation, and a popover of five controls is better served by Tab.
 */
const { open, close } = useApexAccountMenu()
const { user, logout } = useUser()
const isPhone = useMediaQuery('(max-width: 767.98px)')
const isDesk = useMediaQuery('(min-width: 1200px)')

const displayName = computed(() => {
  const u = user.value as any
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || u?.phone || 'My account'
})
const isStaff = computed(() => (user.value as any)?.role === 'ADMIN')

const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (v: boolean) => {
    if (!v) {
      close()
    }
  },
})

const panel = ref<HTMLElement | null>(null)
watch(() => open.value && !isPhone.value, async (shown) => {
  if (shown) {
    await nextTick()
    panel.value?.querySelector<HTMLElement>('a,button')?.focus()
  }
})

onKeyStroke('Escape', () => {
  if (open.value) {
    close()
  }
})

// A route change means a row was used; the menu has done its job.
const route = useRoute()
watch(() => route.fullPath, () => {
  open.value = false
})

function signOut() {
  open.value = false
  logout()
}

const ROW = 'apex-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 text-left text-sm font-medium text-fg-heading hover:bg-hover'
const SHEET_ROW = 'apex-ring flex min-h-[52px] w-full cursor-pointer items-center gap-3.5 rounded-xl px-1 text-left text-[15px] font-medium text-fg-heading'
</script>

<template>
  <div v-if="open && !isPhone">
    <div class="fixed inset-0 z-[60]" aria-hidden="true" @click="close" />
    <div
      ref="panel"
      role="dialog"
      aria-label="Account"
      class="apex-pop-in bg-card border-line-subtle shadow-pop fixed z-[61] flex w-[248px] flex-col gap-0.5 rounded-2xl border p-2"
      :class="isDesk ? 'bottom-[84px] left-[14px]' : 'bottom-4 left-24'"
    >
      <div class="border-line-soft mb-1 flex items-center gap-3 border-b px-2.5 pb-3.5 pt-2.5">
        <ApexPanelAvatar :size="38" />
        <span class="flex min-w-0 flex-col gap-px">
          <span class="text-fg-heading truncate text-sm font-semibold">{{ displayName }}</span>
          <span class="text-fg-muted text-[12.5px]">Client account</span>
        </span>
      </div>
      <NuxtLink to="/dashboards/settings" :class="ROW">
        <Icon name="solar:user-circle-linear" class="text-fg-muted size-[19px]" />Account settings
      </NuxtLink>
      <div class="text-fg-heading flex min-h-12 items-center gap-3 pe-1.5 ps-2.5 text-sm font-medium">
        <Icon name="solar:pallete-2-linear" class="text-fg-muted size-[19px]" /><span class="grow">Theme</span>
        <ApexThemeSwitch />
      </div>
      <NuxtLink v-if="isStaff" to="/admin" :class="ROW">
        <Icon name="solar:shield-user-linear" class="text-fg-muted size-[19px]" />Admin panel
      </NuxtLink>
      <button type="button" :class="ROW" class="border-line-soft mt-1 rounded-t-none border-t" @click="signOut">
        <Icon name="solar:logout-2-linear" class="size-[19px] text-[#EC6453]" />Sign out
      </button>
    </div>
  </div>

  <ApexBottomSheet v-model:open="sheetOpen" surface="panel" title="Account" description="Settings, theme and sign out.">
    <div class="flex flex-col gap-0.5 px-4 pb-5">
      <div class="border-line-soft mb-1 flex items-center gap-3 border-b px-1 pb-4 pt-1.5">
        <ApexPanelAvatar :size="42" />
        <span class="flex min-w-0 grow flex-col gap-px">
          <span class="text-fg-heading truncate text-[15px] font-semibold">{{ displayName }}</span>
          <span class="text-fg-muted text-[13px]">Client account</span>
        </span>
        <button type="button" aria-label="Close" class="apex-ring text-fg-heading inline-flex size-11 cursor-pointer items-center justify-center rounded-xl" @click="close">
          <Icon name="lucide:x" class="size-5" />
        </button>
      </div>
      <NuxtLink to="/dashboards/settings" :class="SHEET_ROW">
        <Icon name="solar:settings-linear" class="text-fg-muted size-[21px]" />Settings
      </NuxtLink>
      <div class="text-fg-heading flex min-h-14 items-center gap-3.5 px-1 text-[15px] font-medium">
        <Icon name="solar:pallete-2-linear" class="text-fg-muted size-[21px]" /><span class="grow">Theme</span>
        <ApexThemeSwitch size="lg" />
      </div>
      <NuxtLink v-if="isStaff" to="/admin" :class="SHEET_ROW">
        <Icon name="solar:shield-user-linear" class="text-fg-muted size-[21px]" />Admin panel
      </NuxtLink>
      <button type="button" :class="SHEET_ROW" @click="signOut">
        <Icon name="solar:logout-2-linear" class="size-[21px] text-[#EC6453]" />Sign out
      </button>
    </div>
  </ApexBottomSheet>
</template>
