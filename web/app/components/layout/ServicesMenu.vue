<script setup lang="ts">
import { routes } from '~/data/routes'
import { services } from '~/data/services'

/**
 * Desktop "Services" dropdown, built as a disclosure (button + list of links)
 * rather than an ARIA menu: it is a set of navigation links, so the links
 * stay in the tab order and need no arrow-key roving.
 *
 * The panel is always in the HTML (toggled with `hidden`), so the seven
 * service URLs are crawlable and work before JavaScript has loaded.
 */
const open = ref(false)
const header = useCmsContent('header')
const root = useTemplateRef<HTMLElement>('root')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')

onClickOutside(root, () => (open.value = false))

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    trigger.value?.focus()
  }
})

// Close when focus tabs out of the menu.
function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) {
    open.value = false
  }
}

const route = useRoute()
watch(() => route.fullPath, () => (open.value = false))

// Lit while the visitor is anywhere in the services section.
const inSection = computed(() => route.path === routes.services || route.path.startsWith(`${routes.services}/`))
</script>

<template>
  <div
    ref="root"
    class="relative"
    @focusout="onFocusOut"
  >
    <button
      ref="trigger"
      type="button"
      class="inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold transition-colors hover:text-violet-600"
      :class="inSection ? 'text-violet-600' : 'text-heading'"
      :aria-expanded="open"
      aria-controls="services-menu"
      @click="open = !open"
    >
      {{ header.servicesLabel }}
      <svg
        class="size-3 text-muted transition-transform duration-150"
        :class="open && 'rotate-180'"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m3 4.5 3 3 3-3"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div
      id="services-menu"
      :hidden="!open"
      class="absolute top-full -left-6 z-10 mt-4 w-165 rounded-2xl border border-line bg-white p-6 shadow-menu"
    >
      <ul class="grid grid-cols-2 gap-x-4 gap-y-1">
        <li
          v-for="service in services"
          :key="service.slug"
        >
          <NuxtLink
            :to="routes.service(service.slug)"
            class="flex flex-col gap-1 rounded-md px-4 py-3 transition-colors hover:bg-subtle"
          >
            <span class="font-display text-[0.9375rem] font-bold text-heading">{{ service.name }}</span>
            <span class="text-[0.8125rem] text-muted">{{ service.menuBlurb }}</span>
          </NuxtLink>
        </li>
        <li>
          <NuxtLink
            :to="routes.services"
            class="flex h-full items-center rounded-md bg-violet-50 px-4 py-3 font-display text-[0.9375rem] font-bold text-violet-600 transition-colors hover:bg-violet-100"
          >
            {{ header.allServices }} →
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
