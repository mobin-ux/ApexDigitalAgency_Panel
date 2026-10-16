<script setup lang="ts">
import { ourWorkHero } from '~/data/our-work'
import { routes } from '~/data/routes'
import { averageEnquiryLift, projectsDelivered, reviewRating } from '~/data/site'

const crumbs = [
  { label: 'Home', to: routes.home },
  { label: 'Our work', to: routes.ourWork },
] as const

const stats = [
  { value: projectsDelivered, label: 'projects delivered for UK businesses' },
  { value: averageEnquiryLift, label: 'average rise in monthly enquiries' },
]
</script>

<template>
  <section
    aria-labelledby="work-hero-title"
    class="container-page pt-10 lg:pt-18"
  >
    <div class="mb-8 lg:mb-8.5">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:gap-18">
      <div class="flex flex-col gap-5">
        <UiEyebrowChip>{{ ourWorkHero.eyebrow }}</UiEyebrowChip>
        <h1
          id="work-hero-title"
          class="max-w-[18ch] font-display text-h1 text-heading"
        >
          {{ ourWorkHero.title }}
        </h1>
        <p class="max-w-[52ch] text-lead text-body">
          {{ ourWorkHero.lead }}
        </p>
      </div>

      <ul class="flex flex-col divide-y divide-line lg:pb-2">
        <li
          v-for="stat in stats"
          :key="stat.label"
          class="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-4 py-4 first:pt-0 last:pb-0"
        >
          <span class="font-display text-[2.125rem] leading-none font-extrabold tracking-[-0.028em] text-heading">{{ stat.value }}</span>
          <span class="text-[0.90625rem] leading-normal text-body">{{ stat.label }}</span>
        </li>
        <li
          v-if="reviewRating.score"
          class="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-4 pt-4"
        >
          <span class="font-display text-[2.125rem] leading-none font-extrabold tracking-[-0.028em] text-heading">{{ reviewRating.score }}<span class="sr-only"> out of 5</span></span>
          <span class="flex flex-col gap-1">
            <UiStars
              :size="12"
              :gap="2"
              class="text-amber-500"
            />
            <span class="text-[0.90625rem] leading-normal text-body">on {{ reviewRating.source }} from verified clients</span>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
