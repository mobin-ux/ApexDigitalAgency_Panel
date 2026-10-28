<script setup lang="ts">
const home = useCmsContent('home')
const { linkAttrs } = useCmsLink()
</script>

<template>
  <section
    aria-labelledby="hero-title"
    class="container-page grid items-center gap-14 pt-14 pb-12 md:pt-20 lg:grid-cols-[1.06fr_0.94fr] lg:gap-16 lg:pt-26 lg:pb-20"
  >
    <div class="flex flex-col gap-7">
      <UiEyebrowChip emoji="👋">
        {{ home.hero.chip }}
      </UiEyebrowChip>

      <h1
        id="hero-title"
        class="max-w-[15ch] font-display text-display text-balance text-heading"
      >
        {{ home.hero.title }}
      </h1>

      <p class="max-w-[46ch] text-lead text-pretty text-body">
        {{ home.hero.lead }}
      </p>

      <div class="mt-1 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
        <UiButton
          v-bind="linkAttrs(home.hero.primary.link)"
          size="lg"
        >
          {{ home.hero.primary.label }}
        </UiButton>
        <UiButton
          v-bind="linkAttrs(home.hero.secondary.link)"
          variant="light"
          size="lg"
        >
          {{ home.hero.secondary.label }}
        </UiButton>
      </div>

      <ul class="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-7 sm:flex sm:items-center sm:gap-8">
        <li
          v-for="(stat, i) in home.hero.stats"
          :key="stat.label"
          class="flex items-center gap-8"
        >
          <span
            v-if="i > 0"
            class="hidden h-10 w-px bg-line sm:block"
            aria-hidden="true"
          />
          <span class="flex flex-col gap-1">
            <span class="font-display text-xl leading-none font-extrabold tracking-tight text-heading sm:text-[1.875rem]">{{ stat.value }}</span>
            <span class="text-[0.8125rem] text-muted sm:text-[0.84375rem]">{{ stat.label }}</span>
          </span>
        </li>
      </ul>
    </div>

    <HomeHeroVisual />
  </section>
</template>
