<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { routes } from '~/data/routes'
import { services } from '~/data/services'

/**
 * Navigation drawer below `lg`. reka-ui's Dialog supplies the parts that are
 * easy to get wrong by hand: focus trap, Escape, scroll lock, focus return.
 */
const open = ref(false)
const panel = usePanelLinks()
const header = useCmsContent('header')
const { linkHref } = useCmsLink()
const mainNav = computed(() => header.value.nav.map(item => ({ label: item.label, to: linkHref(item.link) })))

watch(() => useRoute().fullPath, () => (open.value = false))
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger
      class="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-white px-4 text-sm font-semibold text-heading"
    >
      <svg
        class="size-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 4.5h12M2 8h12M2 11.5h12"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
      Menu
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ink/50 backdrop-blur-xs" />
      <DialogContent
        class="fixed inset-y-0 right-0 z-50 flex w-[min(24rem,100%)] flex-col gap-8 overflow-y-auto bg-page p-6 shadow-menu"
      >
        <div class="flex items-center justify-between">
          <DialogTitle class="font-display text-lg font-bold text-heading">
            Menu
          </DialogTitle>
          <DialogClose
            class="inline-flex size-11 items-center justify-center rounded-md border border-line-strong bg-white text-heading"
            aria-label="Close menu"
          >
            <svg
              class="size-4"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m3.5 3.5 9 9m0-9-9 9"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </DialogClose>
        </div>
        <DialogDescription class="sr-only">
          {{ header.menuDescription }}
        </DialogDescription>

        <nav
          aria-label="Mobile"
          class="flex flex-col gap-6"
        >
          <div>
            <p class="mb-2 text-[0.6875rem] font-bold tracking-widest text-muted uppercase">
              {{ header.servicesLabel }}
            </p>
            <ul class="flex flex-col">
              <li
                v-for="service in services"
                :key="service.slug"
              >
                <NuxtLink
                  :to="routes.service(service.slug)"
                  class="flex min-h-11 items-center rounded-md px-2 text-[0.9375rem] font-semibold text-heading hover:bg-subtle"
                >
                  {{ service.name }}
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  :to="routes.services"
                  class="flex min-h-11 items-center rounded-md px-2 text-[0.9375rem] font-semibold text-violet-600 hover:bg-violet-50"
                >
                  {{ header.allServices }} →
                </NuxtLink>
              </li>
            </ul>
          </div>

          <ul class="flex flex-col border-t border-line pt-4">
            <li
              v-for="link in mainNav"
              :key="link.to"
            >
              <NuxtLink
                :to="link.to"
                class="flex min-h-11 items-center rounded-md px-2 text-[0.9375rem] font-semibold text-heading hover:bg-subtle"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <div class="mt-auto flex flex-col gap-3">
          <UiButton
            :to="routes.contact"
            shape="pill"
            block
          >
            {{ header.start }}
          </UiButton>
          <UiButton
            :href="panel.login"
            variant="light"
            shape="pill"
            block
          >
            {{ header.signIn }}
          </UiButton>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
