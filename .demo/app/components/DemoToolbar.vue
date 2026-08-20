<script setup lang="ts">
const emits = defineEmits<{
  toggleMobileNav: []
}>()

const route = useRoute()
const isSearchOpen = useSearchOpen()
const { t } = useI18n()

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
    76px band: the sidebar's brand block is the same height, so the divider
    below runs straight into the sidebar's own edge and the two read as one.
  -->
  <div class="relative z-10 mb-8">
    <!--
      60px on a phone against the 76px desktop band, and the top safe-area
      inset so the row clears the notch. `--apex-shell-offset` (main.css)
      carries the matching figure for pages that subtract it.
    -->
    <div class="flex min-h-[60px] w-full items-center gap-4 pt-[env(safe-area-inset-top)] lg:h-[76px] lg:min-h-0 lg:pt-0">
      <!--
        Primary mobile navigation control. The bars are decorative (20x10px of
        ink); the tap area is the button, so it carries the size explicitly —
        `-ms-2.5` pulls the extra width back so the icon stays optically flush
        with the breadcrumb below it rather than indenting the whole header.
      -->
      <button
        type="button"
        aria-label="Open navigation menu"
        class="apex-focus hover:bg-muted-100 dark:hover:bg-muted-800 -ms-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors lg:hidden"
        @click="emits('toggleMobileNav')"
      >
        <span class="flex flex-col gap-1.5">
          <span class="bg-muted-500 block h-0.5 w-4" />
          <span class="bg-muted-500 block h-0.5 w-5" />
        </span>
      </button>

      <!--
        The only breadcrumb in the app. Pages used to print a second one inside
        the body that sometimes disagreed with this one; location lives here.
      -->
      <!--
        Below `md` this is a page title, not a trail: at 393px the parent crumb
        and separator only crowd the name, and the bottom bar already shows
        where you are. The full breadcrumb returns from `md` up, where it is
        still the app's single source of location.
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
            {{ route.meta.title }}
          </li>
        </ol>
      </nav>

      <span class="grow" />

      <div class="flex shrink-0 items-center gap-3">
        <!-- Search: icon-only where there is no room for the full field. -->
        <button
          type="button"
          class="apex-focus border-muted-200 dark:border-muted-700 dark:bg-muted-950 text-muted-500 hover:border-muted-300 hover:text-muted-900 dark:hover:border-muted-600 flex size-10 cursor-pointer items-center justify-center rounded-xl border bg-white transition-colors lg:hidden dark:hover:text-white"
          aria-label="Search"
          @click="isSearchOpen = true"
        >
          <Icon name="lucide:search" class="size-[18px]" />
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
    <div class="border-muted-200 dark:border-muted-800 border-b" />
  </div>
</template>
