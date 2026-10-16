<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { routes } from '~/data/routes'
import { services } from '~/data/services'

const props = defineProps<{ page: ServicePageContent }>()

const service = services.find(s => s.slug === props.page.slug)!
const { linkTo } = useServiceLinks(props.page.slug)
const crumbs = [
  { label: 'Home', to: routes.home },
  { label: 'Services', to: routes.services },
  { label: service.shortName, to: routes.service(service.slug) },
]
</script>

<template>
  <section
    aria-labelledby="service-hero-title"
    class="container-page pt-10 pb-16 lg:pt-16 lg:pb-22"
  >
    <div class="mb-8 lg:mb-9">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="grid items-center gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-16">
      <div class="flex flex-col gap-6">
        <p class="flex flex-wrap items-center gap-2.5">
          <span class="rounded-full bg-violet-50 px-3.75 py-1.75 text-[0.78125rem] font-bold text-violet-600">{{ page.hero.badge }}</span>
          <span class="text-[0.84375rem] text-muted">{{ service.shortName }}</span>
        </p>
        <h1
          id="service-hero-title"
          class="max-w-[17ch] font-display text-h1 text-heading"
        >
          {{ page.hero.title }}
        </h1>
        <p class="max-w-[48ch] text-[1.15625rem] leading-[1.6] text-pretty text-body">
          {{ page.hero.lead }}
        </p>
        <ul class="mt-0.5 flex flex-col gap-2.75">
          <li
            v-for="check in page.hero.checks"
            :key="check"
            class="flex items-center gap-2.75 text-[0.96875rem] text-heading"
          >
            <UiTick size="md" />
            {{ check }}
          </li>
        </ul>
        <div class="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <UiButton
            v-bind="linkTo(page.hero.primary.target)"
            size="lg"
          >
            {{ page.hero.primary.label }}
          </UiButton>
          <UiButton
            v-bind="linkTo(page.hero.secondary.target)"
            variant="light"
            size="lg"
          >
            {{ page.hero.secondary.label }}
          </UiButton>
        </div>
      </div>

      <ServiceHeroVisual :visual="page.visual" />
    </div>
  </section>
</template>
