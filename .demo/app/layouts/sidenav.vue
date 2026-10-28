<script setup lang="ts">
/**
 * Customer panel shell — Panel v2 (`Panel Breakpoints.dc.html`).
 *
 * Three shells over one page, chosen by viewport width in CSS so the server
 * render is already the right one (no hydration swap):
 *
 *   ≥ 1200px  260px sidebar with the Services group, 76px top bar
 *   768–1199  88px labelled icon rail, the same 76px top bar
 *   < 768px   60px bar (mark, page title, theme, bell, avatar) + five tabs
 *
 * The phone shell has no drawer: every destination is a tab except Settings,
 * which the account sheet carries. The page scrolls the document rather than
 * an inner `<main>`, so sticky headers inside pages and the browser's own
 * scroll restoration behave as they do everywhere else in the app.
 *
 * The admin shell (`admin.vue`) is untouched — it still renders the V2 Phase 1
 * sidebar, `DemoToolbar` and drawer.
 */
const route = useRoute()
const { current, isCurrent, sidebar, rail, tabs } = useApexPanelNav()
const { show: showAccount, open: accountOpen } = useApexAccountMenu()
const { toggleTheme, toggleLabel, toggleIcon } = useApexTheme()
const { user } = useUser()
const searchOpen = useSearchOpen()

const title = computed(() => (route.meta.title as string | undefined) || current.value?.label || 'Dashboard')
const crumb = computed(() => current.value?.crumb ?? 'Account')

const displayName = computed(() => {
  const u = user.value as any
  return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || u?.phone || 'My account'
})

// The Services group starts open, as drawn, and reopens whenever one of its
// two pages becomes current so the active row is never hidden.
const svcOpen = ref(true)
watch(() => current.value?.id, (id) => {
  if (id === 'new' || id === 'orders') {
    svcOpen.value = true
  }
})

// ⌘K / Ctrl K opens panel search. The hint is platform-aware and resolves after
// mount, because `navigator` does not exist during SSR.
const isMac = ref(true)
onMounted(() => {
  isMac.value = /Mac|iP(?:hone|ad|od)/.test(navigator.platform || navigator.userAgent)
})
onKeyStroke(['k', 'K'], (e) => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    searchOpen.value = true
  }
})

/**
 * A page can take the phone's bottom edge for its own action bar (the New
 * order wizard's footer, a Support thread's composer); five tabs underneath
 * would stack two bars where the thumb rests. A page opts out with
 * `definePageMeta({ bottomNav: false })` or, when it depends on state, with the
 * shared flag from `useApexBottomNav()`.
 */
const { hidden: tabsHidden } = useApexBottomNav()
watch(() => route.path, () => {
  tabsHidden.value = false
})
const showTabs = computed(() => route.meta.bottomNav !== false && !tabsHidden.value)

const { data: appConfig } = useApexConfig()
const maintenanceMode = computed(() => (appConfig.value as any)?.maintenanceMode === true)

const ROW = 'apex-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[14.5px]'
function rowState(on: boolean) {
  return on ? 'apex-panel-nav-active text-nav-fg font-semibold' : 'text-fg-body font-medium hover:bg-hover hover:text-fg-heading'
}
</script>

<template>
  <div class="bg-page text-fg-body min-h-dvh font-sans antialiased">
    <!-- ≥1200px: the full sidebar -->
    <aside aria-label="Sidebar" class="bg-chrome border-line-subtle desk:flex fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r">
      <NuxtLink to="/dashboards/balance" class="apex-ring flex h-[76px] shrink-0 items-center gap-[11px] px-[22px]">
        <img src="/brand/apex-icon.svg" alt="" class="block size-7 dark:hidden">
        <img src="/brand/apex-icon-on-dark.svg" alt="" class="hidden size-7 dark:block">
        <span class="font-heading text-fg-heading text-[22px] font-extrabold tracking-[-0.02em]">Apex</span>
      </NuxtLink>
      <nav aria-label="Primary" class="flex grow flex-col gap-[3px] overflow-y-auto px-3.5 pb-5 pt-2">
        <NuxtLink v-for="d in sidebar.before" :key="d.id" :to="d.to" :aria-current="isCurrent(d.id) ? 'page' : undefined" :class="[ROW, rowState(isCurrent(d.id))]">
          <Icon :name="d.icon" class="size-5 shrink-0" :class="isCurrent(d.id) ? 'text-nav-fg' : 'text-fg-muted'" />
          <span class="grow">{{ d.label }}</span>
        </NuxtLink>
        <div class="flex flex-col gap-0.5">
          <button type="button" :aria-expanded="svcOpen" :class="[ROW, rowState(false)]" @click="svcOpen = !svcOpen">
            <Icon name="solar:suitcase-linear" class="text-fg-muted size-5 shrink-0" />
            <span class="grow">Services</span>
            <Icon :name="svcOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="text-fg-muted size-4" />
          </button>
          <div v-if="svcOpen" class="border-line-subtle mb-1 ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l pl-3.5">
            <NuxtLink
              v-for="d in sidebar.group"
              :key="d.id"
              :to="d.to"
              :aria-current="isCurrent(d.id) ? 'page' : undefined"
              class="apex-ring flex min-h-10 items-center rounded-[10px] px-3 text-sm"
              :class="rowState(isCurrent(d.id))"
            >
              {{ d.label }}
            </NuxtLink>
          </div>
        </div>
        <NuxtLink v-for="d in sidebar.after" :key="d.id" :to="d.to" :aria-current="isCurrent(d.id) ? 'page' : undefined" :class="[ROW, rowState(isCurrent(d.id))]">
          <Icon :name="d.icon" class="size-5 shrink-0" :class="isCurrent(d.id) ? 'text-nav-fg' : 'text-fg-muted'" />
          <span class="grow">{{ d.label }}</span>
        </NuxtLink>
      </nav>
      <div class="border-line-subtle shrink-0 border-t px-3.5 pb-4 pt-3">
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="accountOpen"
          class="apex-ring hover:bg-hover flex min-h-[52px] w-full cursor-pointer items-center gap-[11px] rounded-xl px-2.5 py-2 text-left"
          @click="showAccount"
        >
          <ApexPanelAvatar :size="34" />
          <span class="flex min-w-0 grow flex-col gap-px">
            <span class="text-fg-heading truncate text-sm font-semibold leading-tight">{{ displayName }}</span>
            <span class="text-fg-muted text-[12.5px]">Client account</span>
          </span>
          <Icon name="lucide:chevrons-up-down" class="text-fg-muted size-4" />
        </button>
      </div>
    </aside>

    <!-- 768–1199px: the labelled icon rail -->
    <aside aria-label="Sidebar" class="bg-chrome border-line-subtle desk:hidden fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col items-center border-r md:flex">
      <NuxtLink to="/dashboards/balance" aria-label="Apex home" class="apex-ring flex h-[76px] shrink-0 items-center justify-center rounded-xl">
        <img src="/brand/apex-icon.svg" alt="" class="block size-[30px] dark:hidden">
        <img src="/brand/apex-icon-on-dark.svg" alt="" class="hidden size-[30px] dark:block">
      </NuxtLink>
      <nav aria-label="Primary" class="flex grow flex-col items-center gap-1 overflow-y-auto px-2.5 py-1.5 [scrollbar-width:none]">
        <NuxtLink
          v-for="d in rail"
          :key="d.id"
          :to="d.to"
          :aria-current="isCurrent(d.id) ? 'page' : undefined"
          class="apex-ring flex min-h-[58px] w-[68px] flex-col items-center justify-center gap-[5px] rounded-[14px] text-[11px] font-semibold tracking-[-0.01em]"
          :class="isCurrent(d.id) ? 'apex-panel-nav-active text-nav-fg' : 'text-fg-muted hover:bg-hover hover:text-fg-heading'"
        >
          <Icon :name="d.icon" class="size-[22px]" />
          <span>{{ d.short }}</span>
        </NuxtLink>
      </nav>
      <div class="shrink-0 pb-[18px] pt-3">
        <button type="button" aria-label="Account menu" aria-haspopup="dialog" :aria-expanded="accountOpen" class="apex-ring inline-flex size-12 cursor-pointer items-center justify-center rounded-full" @click="showAccount">
          <ApexPanelAvatar :size="38" />
        </button>
      </div>
    </aside>

    <div class="desk:pl-[260px] flex min-h-dvh min-w-0 flex-col md:pl-[88px]">
      <!-- ≥768px: breadcrumb, search, theme, bell -->
      <header class="bg-glass border-line-subtle sticky top-0 z-30 hidden h-[76px] shrink-0 items-center gap-3 border-b px-[clamp(20px,3vw,40px)] backdrop-blur-[16px] md:flex">
        <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-2 text-sm">
          <span class="text-fg-muted">{{ crumb }}</span>
          <span aria-hidden="true" class="text-line-strong">/</span>
          <span aria-current="page" class="text-fg-heading truncate font-semibold">{{ title }}</span>
        </nav>
        <span class="grow" />
        <button
          type="button"
          aria-label="Search orders and requests"
          class="apex-ring bg-card border-line-subtle text-fg-muted flex h-[42px] w-[clamp(180px,22vw,280px)] cursor-text items-center gap-[9px] rounded-xl border pl-3.5 pr-2 text-sm"
          @click="searchOpen = true"
        >
          <Icon name="lucide:search" class="size-[17px] shrink-0" />
          <span class="min-w-0 grow truncate text-left">Search orders and requests</span>
          <span class="text-fg-body bg-raised border-line-subtle whitespace-nowrap rounded-[7px] border px-[7px] py-[3px] text-[11.5px] font-bold">{{ isMac ? '⌘K' : 'Ctrl K' }}</span>
        </button>
        <button type="button" :aria-label="toggleLabel" :title="toggleLabel" class="apex-ring bg-card border-line-subtle text-fg-heading hover:border-line-strong inline-flex size-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border" @click="toggleTheme">
          <Icon :name="toggleIcon" class="size-[19px]" />
        </button>
        <ApexPanelNotifications variant="bar" />
      </header>

      <!-- <768px: mark, title, theme, bell, account -->
      <header class="bg-glass border-line-subtle sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-1 border-b pl-[max(16px,env(safe-area-inset-left))] pr-[max(6px,env(safe-area-inset-right))] backdrop-blur-[16px] md:hidden">
        <img src="/brand/apex-icon.svg" alt="" class="mr-2 block size-[26px] dark:hidden">
        <img src="/brand/apex-icon-on-dark.svg" alt="" class="mr-2 hidden size-[26px] dark:block">
        <span class="font-heading text-fg-heading truncate text-lg font-bold tracking-[-0.02em]">{{ title }}</span>
        <span class="grow" />
        <button type="button" :aria-label="toggleLabel" class="apex-ring text-fg-heading inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl" @click="toggleTheme">
          <Icon :name="toggleIcon" class="size-[21px]" />
        </button>
        <ApexPanelNotifications variant="phone" />
        <button type="button" aria-label="Account menu" aria-haspopup="dialog" :aria-expanded="accountOpen" class="apex-ring inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full" @click="showAccount">
          <ApexPanelAvatar :size="32" />
        </button>
      </header>

      <main class="min-w-0 grow">
        <ApexAnnouncementBar :announcement="(appConfig as any)?.announcement ?? null" />
        <ApexVerifyEmailBanner :mail-available="(appConfig as any)?.features?.mail === true" />
        <div v-if="maintenanceMode" role="status" class="bg-st-warning-bg text-st-warning-fg mx-[clamp(16px,3vw,40px)] mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px] leading-normal">
          <Icon name="lucide:hard-hat" class="mt-0.5 size-4 shrink-0" />
          <span><strong>Scheduled maintenance in progress.</strong> Some actions may be briefly unavailable. Your data and payments are safe.</span>
        </div>
        <slot />
      </main>

      <!-- <768px: five tabs; the spacer keeps the last row of every page clear of them -->
      <template v-if="showTabs">
        <div aria-hidden="true" class="h-[calc(66px+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
        <nav aria-label="Primary" class="bg-glass border-line-subtle fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-[16px] md:hidden">
          <NuxtLink
            v-for="d in tabs"
            :key="d.id"
            :to="d.to"
            :aria-current="isCurrent(d.id) ? 'page' : undefined"
            class="apex-ring flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-xl text-[11px]"
            :class="isCurrent(d.id) ? 'text-accent-ink font-bold' : 'text-fg-muted font-semibold'"
          >
            <Icon :name="d.icon" class="size-[23px]" />
            <span>{{ d.short }}</span>
          </NuxtLink>
        </nav>
      </template>
    </div>

    <ApexPanelAccountMenu />
    <ApexSearch />
  </div>
</template>
