<script setup lang="ts">
import { routes } from '~/data/routes'

const page = useCmsContent('contact')
const contactHero = computed(() => page.value.hero)
const contactStats = computed(() => page.value.stats.filter(stat => stat.value))

const header = useCmsContent('header')
const crumbs = computed(() => [
  { label: header.value.sections.home, to: routes.home },
  { label: header.value.sections.contact, to: routes.contact },
])
</script>

<template>
  <section
    aria-labelledby="contact-title"
    class="container-page pt-10 lg:pt-18"
  >
    <div class="mb-8 lg:mb-8.5">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:gap-18">
      <div class="flex flex-col gap-5">
        <UiEyebrowChip emoji="👋">
          {{ contactHero.eyebrow }}
        </UiEyebrowChip>
        <h1
          id="contact-title"
          class="max-w-[17ch] font-display text-h1 text-heading"
        >
          {{ contactHero.title }}
        </h1>
        <p class="max-w-[54ch] text-lead text-body">
          {{ contactHero.lead }}
        </p>
      </div>

      <dl
        v-if="contactStats.length"
        class="flex flex-col divide-y divide-line lg:pb-2"
      >
        <div
          v-for="stat in contactStats"
          :key="stat.label"
          class="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-4 py-4 first:pt-0 last:pb-0"
        >
          <dt class="order-2 text-[0.90625rem] leading-normal text-body">
            {{ stat.label }}
          </dt>
          <dd class="order-1 font-display text-[2.125rem] leading-none font-extrabold tracking-[-0.028em] text-heading">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
