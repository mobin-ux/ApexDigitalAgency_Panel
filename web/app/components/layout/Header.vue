<script setup lang="ts">
import { routes } from '~/data/routes'

const header = useCmsContent('header')
const { linkHref } = useCmsLink()
const mainNav = computed(() => header.value.nav.map(item => ({ label: item.label, to: linkHref(item.link) })))
const route = useRoute()

// The section's own page is "page"; its child pages, such as a case study
// under Our work, mark the section link "true". Homepage anchors are never current.
function currentFor(to: string): 'page' | 'true' | undefined {
  if (to.includes('#')) {
    return undefined
  }
  if (route.path === to) {
    return 'page'
  }
  return route.path.startsWith(`${to}/`) ? 'true' : undefined
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-lg">
    <div
      v-if="route.meta.readingProgress"
      class="reading-progress absolute -bottom-px left-0 h-0.75 w-full bg-violet-500"
      aria-hidden="true"
    />
    <div class="container-page flex items-center gap-4 py-3 lg:gap-10 lg:py-5">
      <NuxtLink
        :to="routes.home"
        class="block shrink-0"
      >
        <img
          src="/brand/apex-wordmark.svg"
          alt="Apex Digital Agency"
          width="104"
          height="28"
          class="block h-7 w-auto"
        >
      </NuxtLink>

      <nav
        aria-label="Main"
        class="hidden items-center gap-7.5 lg:flex"
      >
        <LayoutServicesMenu />
        <NuxtLink
          v-for="link in mainNav"
          :key="link.to"

          :to="link.to"
          :aria-current="currentFor(link.to)"
          class="text-[0.9375rem] font-semibold text-heading transition-colors hover:text-violet-600 aria-[current=page]:text-violet-600 aria-[current=true]:text-violet-600"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-5">
        <div class="hidden sm:block">
          <UiButton
            :to="routes.contact"
            size="sm"
            shape="pill"
          >
            {{ header.start }}
          </UiButton>
        </div>
        <div class="lg:hidden">
          <LayoutMobileMenu />
        </div>
      </div>
    </div>
  </header>
</template>
