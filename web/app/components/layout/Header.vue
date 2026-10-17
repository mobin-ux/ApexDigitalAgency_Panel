<script setup lang="ts">
import { routes } from '~/data/routes'
import { mainNav } from '~/data/site'

const panel = usePanelLinks()
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
        <a
          :href="panel.login"
          class="hidden text-[0.9063rem] font-semibold text-body transition-colors hover:text-violet-600 lg:inline"
        >
          Client login
        </a>
        <div class="hidden sm:block">
          <UiButton
            :to="routes.contact"
            size="sm"
            shape="pill"
          >
            Get in touch
          </UiButton>
        </div>
        <div class="lg:hidden">
          <LayoutMobileMenu />
        </div>
      </div>
    </div>
  </header>
</template>
