<script setup lang="ts">
import type { CaseStudy } from '~/data/case-studies'
import { caseStudyCta } from '~/data/case-study-page'
import { routes } from '~/data/routes'
import { serviceBySlug } from '~/data/services'

const props = defineProps<{ study: CaseStudy }>()

// The offer is the study's lead service: its price, timeline and order link.
const primary = serviceBySlug(props.study.services[0]!)
const { contact } = useServiceLinks(primary.slug)

const copy = props.study.story?.cta ?? caseStudyCta.fallback
// Only a website "goes live"; other services' timelines read as a duration
// ("3–6 months to compound"), so the launch line is for website work alone.
const checks = primary.slug === 'website-design'
  ? [`Live in ${primary.timeline}`, ...caseStudyCta.checks]
  : [...caseStudyCta.checks]
</script>

<template>
  <section
    aria-labelledby="case-cta-title"
    class="bg-page px-4 pb-20 sm:px-6 lg:pb-26"
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
          {{ copy.eyebrow }}
        </UiEyebrowChip>
        <h2
          id="case-cta-title"
          class="font-display text-h2 text-white lg:text-[2.75rem]"
        >
          {{ copy.title }}
        </h2>
        <p class="text-[1.0625rem] leading-[1.62] text-body-on-dark">
          {{ copy.body }}
        </p>
        <ul class="flex flex-wrap gap-x-6 gap-y-2.5 pt-1">
          <li
            v-for="check in checks"
            :key="check"
            class="flex items-center gap-2.25 text-sm whitespace-nowrap text-white"
          >
            <UiTick />
            {{ check }}
          </li>
        </ul>
      </div>

      <div class="relative flex w-full flex-none flex-col gap-4.5 lg:ml-auto lg:w-75">
        <p
          v-if="primary.fromMonthly"
          class="flex items-baseline gap-2"
        >
          <span class="text-[0.8125rem] text-body-on-dark">From</span>
          <span class="font-display text-[2.875rem] leading-none font-extrabold tracking-[-0.03em] text-white">{{ formatGbp(primary.fromMonthly) }}</span>
          <span class="text-[0.9375rem] font-semibold text-body-on-dark">/month</span>
        </p>
        <UiButton
          :to="contact()"
          size="lg"
          block
        >
          {{ caseStudyCta.button }}
        </UiButton>
        <NuxtLink
          :to="routes.contact"
          class="text-center text-sm font-semibold text-violet-200 hover:text-white"
        >
          {{ caseStudyCta.call }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
