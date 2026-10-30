<script setup lang="ts">
import { navItemFor } from '~/utils/adminNav'

/**
 * The admin console shell (`Admin Console.dc.html`, 2026-10-31).
 *
 * 236px sidebar on the shell plane from `lg`, a drawer below it; a 64px top
 * bar with the breadcrumb (group › screen, or screen › record with a back
 * arrow on a detail page), the ⌘K search, a link to the live site and the
 * theme switch. The page sits on the desk plane underneath.
 *
 * Light and dark both, as the design draws them; the switch is the panel's
 * one `useApexTheme`, so the customer panel and the console share a choice.
 * The record name in the breadcrumb arrives after hydration
 * (`useAdminCrumb`), so the server and the first client render agree.
 */
const route = useRoute()
const { toggleTheme, toggleLabel, toggleIcon } = useApexTheme()
const { show: openPalette } = useAdminPalette()
const crumb = useAdminCrumb()
useAdminNavCounts()

const drawer = ref(false)
watch(() => route.fullPath, () => {
  drawer.value = false
})

const item = computed(() => navItemFor(route.path))
/** A detail page is any route below its row's list (`/admin/projects/:id`). */
const isDetail = computed(() => Boolean(item.value && route.path.replace(/\/$/, '') !== item.value.to))

const crumbGroup = computed(() => {
  if (isDetail.value) {
    return item.value?.label ?? 'Admin'
  }
  return item.value?.group || 'Admin'
})
const crumbTitle = computed(() => {
  if (isDetail.value) {
    return crumb.value.title ?? 'Details'
  }
  return item.value?.label ?? 'Overview'
})
const { can } = useStaffAccess()
const lockedBy = computed(() => (item.value?.needs && !can(item.value.needs) ? item.value.needs : null))

const backTo = computed(() => crumb.value.back ?? item.value?.to ?? '/admin')

// The public site. `runtimeConfig.public.siteUrl` is the panel's own origin.
const liveSite = 'https://apexdigi.co.uk/'

useHead({ titleTemplate: t => (t ? `${t} · Apex admin` : 'Apex admin') })

function onDrawerKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    drawer.value = false
  }
}
</script>

<template>
  <div class="bg-desk text-fg-body min-h-dvh font-sans antialiased">
    <a href="#admin-main" class="apex-ring bg-card text-fg-heading sr-only rounded-xl px-4 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]">Skip to content</a>

    <!-- Fixed rail from lg. -->
    <aside class="border-line-subtle bg-shell fixed inset-y-0 start-0 z-30 hidden w-[236px] border-e lg:block">
      <AdminConsoleSidebar />
    </aside>

    <!-- Drawer below lg: invisible when closed so its links leave the tab order (Phase 1 Mobile). -->
    <div class="lg:hidden" @keydown="onDrawerKey">
      <div v-if="drawer" class="apex-scrim-in fixed inset-0 z-40 bg-[rgba(3,10,12,.45)]" aria-hidden="true" @click="drawer = false" />
      <aside
        id="admin-drawer"
        class="border-line-subtle bg-shell fixed inset-y-0 start-0 z-50 w-[min(300px,calc(100%-68px))] border-e transition-transform duration-200"
        :class="drawer ? 'visible translate-x-0' : 'invisible -translate-x-full'"
        :aria-hidden="!drawer"
      >
        <AdminConsoleSidebar @navigate="drawer = false" />
      </aside>
    </div>

    <div class="flex min-h-dvh flex-col lg:ps-[236px]">
      <header class="border-line-subtle bg-shell sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-6">
        <button
          type="button"
          class="apex-ring border-line-subtle text-fg-heading inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border lg:hidden"
          aria-label="Open navigation"
          aria-controls="admin-drawer"
          :aria-expanded="drawer"
          @click="drawer = true"
        >
          <Icon name="lucide:menu" class="size-[18px]" />
        </button>
        <NuxtLink
          v-if="isDetail"
          :to="backTo"
          aria-label="Back"
          class="apex-ring border-line-subtle text-fg-heading inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border"
        >
          <Icon name="lucide:arrow-left" class="size-4" />
        </NuxtLink>
        <nav aria-label="Breadcrumb" class="flex min-w-0 flex-1 items-center gap-2 text-[13.5px]">
          <span class="text-fg-muted hidden whitespace-nowrap sm:inline">{{ crumbGroup }}</span>
          <Icon name="lucide:chevron-right" class="text-fg-muted hidden size-3.5 shrink-0 sm:block" aria-hidden="true" />
          <span class="text-fg-heading truncate font-semibold" aria-current="page">{{ crumbTitle }}</span>
        </nav>
        <button
          type="button"
          class="apex-ring border-line-subtle bg-desk text-fg-muted hidden h-[38px] w-[300px] shrink items-center gap-[9px] rounded-[10px] border pe-2.5 ps-3 text-[13.5px] md:flex"
          @click="openPalette"
        >
          <Icon name="lucide:search" class="size-[15px] shrink-0" />
          <span class="flex-1 truncate text-start">Search clients, projects, pages…</span>
          <kbd class="border-line-subtle rounded-md border px-1.5 py-0.5 font-sans text-[11px] font-semibold">⌘K</kbd>
        </button>
        <button
          type="button"
          class="apex-ring border-line-subtle text-fg-heading inline-flex size-[38px] shrink-0 items-center justify-center rounded-[10px] border md:hidden"
          aria-label="Search"
          @click="openPalette"
        >
          <Icon name="lucide:search" class="size-4" />
        </button>
        <a
          :href="liveSite"
          target="_blank"
          rel="noopener"
          class="apex-ring border-line-subtle text-fg-heading hidden h-[38px] shrink-0 items-center gap-[7px] rounded-[10px] border px-3 text-[13.5px] font-medium xl:inline-flex"
        >
          apexdigi.co.uk <Icon name="lucide:arrow-up-right" class="size-3.5" />
          <span class="sr-only">(opens in a new tab)</span>
        </a>
        <button
          type="button"
          class="apex-ring border-line-subtle text-fg-heading inline-flex size-[38px] shrink-0 items-center justify-center rounded-[10px] border"
          :aria-label="toggleLabel"
          @click="toggleTheme"
        >
          <Icon :name="toggleIcon" class="size-[17px]" />
        </button>
      </header>

      <main id="admin-main" class="min-w-0 flex-1">
        <!-- A destination the role cannot open shows the wall, never a page that 403s its own data. -->
        <AdminAccessWall v-if="lockedBy" :permission="lockedBy" />
        <slot v-else />
      </main>
    </div>

    <AdminCommandPalette />
    <AdminConfirmHost />
  </div>
</template>
