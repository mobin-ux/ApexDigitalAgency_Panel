<script setup lang="ts">
import { aboutCta as ctaData } from '~/data/about'
import { routes } from '~/data/routes'

const page = useCmsContent('about')
const aboutCta = computed(() => ({ ...page.value.cta, facts: ctaData.facts }))
</script>

<template>
  <section
    aria-labelledby="about-cta-title"
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
          {{ aboutCta.eyebrow }}
        </UiEyebrowChip>
        <h2
          id="about-cta-title"
          class="font-display text-h2 text-white lg:text-[2.75rem]"
        >
          {{ aboutCta.title }}
        </h2>
        <p class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ aboutCta.body }}
        </p>
      </div>

      <div class="relative flex w-full flex-none flex-col gap-4.5 lg:ml-auto lg:w-75">
        <UiButton
          :to="routes.contact"
          size="lg"
          block
        >
          {{ aboutCta.button }}
        </UiButton>
        <div
          class="h-px bg-white/10"
          aria-hidden="true"
        />
        <dl class="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-3">
          <template
            v-for="fact in aboutCta.facts"
            :key="fact.label"
          >
            <dt class="text-[0.78125rem] whitespace-nowrap text-muted-on-dark">
              {{ fact.label }}
            </dt>
            <dd
              class="text-[0.90625rem]"
              :class="fact.strong ? 'font-semibold text-white' : 'text-body-on-dark'"
            >
              {{ fact.value }}
            </dd>
          </template>
        </dl>
      </div>
    </div>
  </section>
</template>
