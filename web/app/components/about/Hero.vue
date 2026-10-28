<script setup lang="ts">
import { aboutHero as aboutLinks, aboutPhotos, aboutStats } from '~/data/about'
import { routes } from '~/data/routes'

const page = useCmsContent('about')
const header = useCmsContent('header')
const aboutHero = computed(() => ({
  ...page.value.hero,
  team: { label: page.value.hero.teamLink, to: aboutLinks.team.to },
  company: { label: page.value.hero.companyLink, to: aboutLinks.company.to },
}))
const crumbs = computed(() => [
  { label: header.value.sections.home, to: routes.home },
  { label: header.value.sections.about, to: routes.about },
])
</script>

<template>
  <section
    aria-labelledby="about-title"
    class="container-page pt-10 lg:pt-18"
  >
    <div class="mb-8 lg:mb-8.5">
      <UiBreadcrumbs :items="crumbs" />
    </div>

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:gap-18">
      <div class="flex flex-col gap-5">
        <UiEyebrowChip emoji="👋">
          {{ aboutHero.eyebrow }}
        </UiEyebrowChip>
        <h1
          id="about-title"
          class="max-w-[17ch] font-display text-h1 text-heading"
        >
          {{ aboutHero.title }}
        </h1>
        <p class="max-w-[54ch] text-lead text-body">
          {{ aboutHero.lead }}
        </p>
        <div class="flex flex-wrap items-center gap-3.5 pt-2">
          <UiButton
            :to="aboutHero.team.to"
            variant="ink"
          >
            {{ aboutHero.team.label }} <span
              class="text-violet-400"
              aria-hidden="true"
            >↓</span>
          </UiButton>
          <UiButton
            :to="aboutHero.company.to"
            variant="light"
          >
            {{ aboutHero.company.label }}
          </UiButton>
        </div>
      </div>

      <dl
        v-if="aboutStats.length"
        class="flex flex-col divide-y divide-line lg:pb-2"
      >
        <div
          v-for="stat in aboutStats"
          :key="stat.label"
          class="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-4 py-4 first:pt-0 last:pb-0"
        >
          <dt class="order-2 flex flex-col gap-1 text-[0.90625rem] leading-normal text-body">
            <UiStars
              v-if="stat.stars"
              :size="13"
              :gap="2"
              class="text-amber-500"
            />
            {{ stat.label }}
          </dt>
          <dd class="order-1 font-display text-[2.125rem] leading-none font-extrabold tracking-[-0.028em] text-heading">
            {{ stat.value }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="relative mt-12 h-65 overflow-hidden rounded-3xl shadow-card sm:h-100 lg:mt-16 lg:h-130">
      <UiMediaFrame
        :image="aboutPhotos.team"
        priority
        sizes="100vw lg:1152px"
      />
      <p
        v-if="aboutPhotos.team"
        class="pointer-events-none absolute bottom-6 left-6 flex items-center gap-2.5 rounded-full border border-line bg-white px-4 py-2.5 text-[0.84375rem] font-semibold whitespace-nowrap text-heading shadow-toast"
      >
        <UiTick size="lg" />
        {{ aboutHero.photoCaption }}
      </p>
    </div>
  </section>
</template>
