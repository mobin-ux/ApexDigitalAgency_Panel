<script setup lang="ts">
import { routes } from '~/data/routes'

const page = useCmsContent('insights')
const cta = computed(() => page.value.cta)
</script>

<template>
  <section
    aria-labelledby="insights-cta-title"
    class="bg-page px-4 py-20 sm:px-6 lg:py-26"
  >
    <div class="relative mx-auto flex max-w-300 flex-col gap-10 overflow-hidden rounded-4xl bg-ink-900 px-6 py-12 sm:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-15">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_120%_at_88%_26%,rgb(125_83_242/0.28),transparent_60%)]"
        aria-hidden="true"
      />

      <div class="relative flex max-w-[54ch] flex-col gap-4.5">
        <UiEyebrowChip
          tone="dark"
          emoji="👋"
        >
          {{ cta.eyebrow }}
        </UiEyebrowChip>
        <h2
          id="insights-cta-title"
          class="font-display text-h2 text-white lg:text-[2.75rem]"
        >
          {{ cta.title }}
        </h2>
        <p class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ cta.body }}
        </p>
      </div>

      <div class="relative flex w-full flex-none flex-col gap-4.5 lg:ml-auto lg:w-75">
        <UiButton
          :to="routes.contact"
          size="lg"
          block
        >
          {{ cta.button }}
        </UiButton>
        <div
          class="h-px bg-white/10"
          aria-hidden="true"
        />
        <ul class="flex flex-col gap-3">
          <li
            v-for="check in cta.checks"
            :key="check"
            class="flex items-center gap-2.5 text-sm text-white"
          >
            <UiTick />
            {{ check }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
