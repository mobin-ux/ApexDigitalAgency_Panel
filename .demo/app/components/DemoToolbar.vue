<script setup lang="ts">
const emits = defineEmits<{
  toggleMobileNav: []
}>()

const route = useRoute()
const isSearchOpen = useSearchOpen()
const { t } = useI18n()

/**
 * Task mode (V2 Phase 3 mobile, §1). On a wizard route below `lg` the bar stops
 * being navigation: the hamburger becomes a close button, and search and
 * notifications step out so the only thing inviting the customer away from a
 * half-signed order is the control that asks first.
 *
 * Derived from the route rather than pushed up from the page, so the server and
 * the first client render already agree — a page setting shared state in its own
 * `setup()` runs *after* this component has rendered, which would show the
 * hamburger for a frame before it swapped.
 */
const { isTask, closeRequests } = useApexTaskBar()

/**
 * Sub-view mode (V2 Phase 4 mobile, §1). Inside one record of a page — a
 * single project on My Orders — the bar names the record and offers the way
 * back out of it, because on a phone the page's own back button scrolls away
 * exactly when it is needed. Route-derived for the same reason task mode is.
 */
const { isSubView, backLabel, barTitle: subViewTitle, leave: leaveSubView } = useApexSubView()

/**
 * Platform-aware shortcut hint, resolved after mount.
 *
 * The server has no idea what the visitor is typing on, so anything derived
 * from `navigator` is a guaranteed hydration mismatch if it is rendered during
 * SSR — which is exactly what the layer's `useIsMacLike()` did (it resolves in
 * `onBeforeMount`, i.e. before the hydration render). Both renders agree on
 * "Ctrl" here, and the swap happens after hydration has finished.
 */
const isMac = ref(false)
onMounted(() => {
  isMac.value = /Mac|iP(?:hone|ad|od)/.test(navigator.platform || navigator.userAgent)
})
</script>

<template>
  <!--
    56px on a phone, 76px from `lg` where the sidebar's brand block is the same
    height and the two read as one band across the top of the app.

    Sticky and full-bleed below `lg`: the bar is the only navigation anchor on a
    phone, so it stays put while the page scrolls under it, and it spans the
    viewport rather than sitting inside the page gutter. That is why it lives
    outside the layout's padded wrapper and carries its own padding — 6px on a
    phone, so each 44px control still reads as inset, and the shared page gutter
    from `lg` up so the bar's contents line up with the content below them.

    `--apex-shell-offset` (main.css) carries the matching total for pages that
    subtract it: band + bottom margin + divider.
  -->
  <div
    class="border-muted-200 dark:border-muted-800 dark:bg-muted-950/[.92] sticky top-0 z-30 mb-5 border-b bg-white/[.92] pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] backdrop-blur-[10px] lg:static lg:mb-8 lg:bg-transparent lg:pl-[max(1.5rem,env(safe-area-inset-left))] lg:pr-[max(1.5rem,env(safe-area-inset-right))] lg:backdrop-blur-none xl:pl-[max(2rem,env(safe-area-inset-left))] xl:pr-[max(2rem,env(safe-area-inset-right))] dark:lg:bg-transparent"
  >
    <div class="flex min-h-[56px] w-full items-center gap-1 lg:h-[76px] lg:min-h-0 lg:gap-4">
      <!--
        Primary mobile navigation control. The bars are decorative (20x10px of
        ink); the tap area is the button, so it carries the size explicitly.
      -->
      <button
        v-if="!isTask && !isSubView"
        type="button"
        aria-label="Open navigation menu"
        class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
        @click="emits('toggleMobileNav')"
      >
        <span class="flex flex-col gap-1.5">
          <span class="bg-muted-500 block h-0.5 w-4" />
          <span class="bg-muted-500 block h-0.5 w-5" />
        </span>
      </button>
      <!--
        One level down, the hamburger is the wrong offer: the customer wants out
        of this record, not into the menu. Unlike task mode there is nothing to
        lose here, so the bar can act rather than ask.
      -->
      <button
        v-else-if="isSubView"
        type="button"
        :aria-label="backLabel"
        class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 text-muted-600 dark:text-muted-200 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
        @click="leaveSubView"
      >
        <Icon name="lucide:arrow-left" class="size-5" />
      </button>
      <!--
        The page owns what closing means — it is the only thing that knows
        whether there is a half-filled order to lose — so the bar asks and waits
        rather than routing anywhere itself.
      -->
      <button
        v-else
        type="button"
        aria-label="Leave order"
        class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 text-muted-600 dark:text-muted-200 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
        @click="closeRequests++"
      >
        <Icon name="lucide:x" class="size-5" />
      </button>

      <!--
        Below `lg` this is a page title, not a trail. The `Account / Dashboard`
        crumb spent a whole line at 393px restating the word already in the
        title, and the drawer's active row carries location just as well. The
        full breadcrumb returns from `lg` up, where it is still the app's single
        source of location — pages must never print a second one.
      -->
      <nav aria-label="Breadcrumb" class="min-w-0">
        <ol class="flex min-w-0 items-center gap-2 lg:text-[13.5px]">
          <li class="text-muted-500 hidden lg:block">
            {{ route.path.startsWith('/admin') ? 'Admin' : 'Account' }}
          </li>
          <li aria-hidden="true" class="text-muted-400 dark:text-muted-600 hidden lg:block">
            /
          </li>
          <li
            aria-current="page"
            class="font-heading text-muted-900 truncate text-[17px] font-extrabold tracking-[-0.02em] lg:font-sans lg:text-[13.5px] lg:font-semibold lg:tracking-normal dark:text-white"
          >
            <!--
              Below `lg` a sub-view shows the record's own name; the desktop
              breadcrumb keeps naming the section, because the detail still
              prints its own back button and heading there. The fallback is the
              section title, so the server and the first client render agree
              even though the name only arrives once the page has fetched it.
            -->
            <template v-if="isSubView">
              <span class="lg:hidden">{{ subViewTitle || route.meta.title }}</span>
              <span class="hidden lg:inline">{{ route.meta.title }}</span>
            </template>
            <template v-else>
              {{ route.meta.title }}
            </template>
          </li>
        </ol>
      </nav>

      <span class="grow" />

      <!--
        In task mode the reassurance the heading row carries on desktop moves
        into the bar, where the page header no longer is.
      -->
      <span
        v-if="isTask"
        class="me-1.5 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#22B07D]/12 px-3 text-[11.5px] font-bold text-[#22B07D] lg:hidden"
      >
        <Icon name="lucide:lock" class="size-3.5" />Secured
      </span>

      <div class="shrink-0 items-center gap-0.5 lg:gap-3" :class="isTask ? 'hidden lg:flex' : 'flex'">
        <!--
          Search: a 44px plain icon below `lg`. The 250px field and the ⌘K hint
          are desktop affordances — there is no hardware keyboard to hint at,
          and the hint alone costs 60px of a 393px bar.
        -->
        <button
          type="button"
          class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 text-muted-600 dark:text-muted-300 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
          aria-label="Search"
          @click="isSearchOpen = true"
        >
          <Icon name="lucide:search" class="size-[19px]" />
        </button>
        <button
          type="button"
          class="apex-focus border-muted-200 dark:border-muted-700 dark:bg-muted-950 text-muted-500 hover:border-muted-300 hover:text-muted-900 dark:hover:border-muted-600 hidden h-10 w-[250px] cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 text-start text-[13.5px] transition-colors lg:flex dark:hover:text-white"
          aria-label="Search"
          @click="isSearchOpen = true"
        >
          <Icon name="lucide:search" class="size-[17px] shrink-0" />
          <span class="grow truncate">{{ t('components.toolbar.search') }}</span>
          <BaseKbd size="sm" variant="default" class="!font-semibold shrink-0">
            {{ isMac ? '⌘K' : 'Ctrl K' }}
          </BaseKbd>
        </button>

        <ApexNotificationsMenu />
      </div>
    </div>
  </div>
</template>
