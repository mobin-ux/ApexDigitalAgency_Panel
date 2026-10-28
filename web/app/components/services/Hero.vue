<script setup lang="ts">
import { planTermMonths } from '~/data/home'
import { routes } from '~/data/routes'
import { services } from '~/data/services'
import { projectsDelivered } from '~/data/site'

const page = useCmsContent('services')
const header = useCmsContent('header')
const crumbs = computed(() => [
  { label: header.value.sections.home, to: routes.home },
  { label: header.value.sections.services, to: routes.services },
])

// Every figure is derived or shared, so the count cannot fall behind the list.
const stats = [
  { value: String(services.length), label: 'services, each on a monthly plan' },
  { value: projectsDelivered, label: 'projects delivered for UK businesses' },
  { value: String(planTermMonths), label: 'monthly payments, no interest' },
]
</script>

<template>
  <section
    aria-labelledby="services-hero-title"
    class="container-page pt-10 lg:pt-18"
  >
    <div class="mb-8 lg:mb-8.5">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:gap-18">
      <div class="flex flex-col gap-5">
        <UiEyebrowChip>{{ page.hero.chip }}</UiEyebrowChip>
        <h1
          id="services-hero-title"
          class="max-w-[20ch] font-display text-h1 text-heading"
        >
          {{ page.hero.title }}
        </h1>
        <p class="max-w-[50ch] text-lead text-body">
          {{ page.hero.lead }}
        </p>
      </div>

      <ul class="flex flex-col divide-y divide-line lg:pb-2">
        <li
          v-for="stat in stats"
          :key="stat.label"
          class="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-4 py-4 first:pt-0 last:pb-0"
        >
          <span class="font-display text-[2.125rem] leading-none font-extrabold tracking-[-0.028em] text-heading">{{ stat.value }}</span>
          <span class="text-[0.90625rem] leading-normal text-body">{{ stat.label }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
