<script setup lang="ts">
import { formatGbp } from '~/utils/format'

/**
 * Pricing for work that is quoted rather than listed: the steps from a free
 * call to a quoted build, then the two ways to start.
 */
const props = defineProps<{
  steps: readonly { name: string, price: number | null, note: string, detail: string }[]
  contactHref: string
}>()

const priced = props.steps.map(step => ({
  ...step,
  label: step.price === null ? 'Quoted' : step.price === 0 ? 'Free' : formatGbp(step.price),
}))
</script>

<template>
  <div class="flex flex-col gap-10">
    <div class="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-4 sm:px-11 sm:py-11">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_130%_at_88%_10%,rgb(125_83_242/0.28),transparent_62%)]"
        aria-hidden="true"
      />
      <ol class="relative grid md:grid-cols-3">
        <li
          v-for="(step, i) in priced"
          :key="step.name"
          class="relative flex flex-col gap-3.5 py-7 md:px-8 md:py-1"
          :class="i > 0 && 'border-t border-white/10 md:border-t-0 md:border-l'"
        >
          <h3 class="flex items-center gap-2.5 font-display text-[1.1875rem] font-semibold tracking-[-0.018em] text-white">
            <span
              class="inline-flex size-7 flex-none items-center justify-center rounded-full bg-violet-500 text-[0.8125rem]"
              aria-hidden="true"
            >{{ i + 1 }}</span>
            {{ step.name }}
          </h3>
          <p class="font-display text-[2.5rem] leading-none font-extrabold tracking-[-0.03em] text-white tabular-nums">
            {{ step.label }}
          </p>
          <p class="text-[0.78125rem] font-bold tracking-[0.06em] text-violet-200 uppercase">
            {{ step.note }}
          </p>
          <p class="text-[0.90625rem] leading-relaxed text-body-on-dark">
            {{ step.detail }}
          </p>
        </li>
      </ol>
    </div>

    <div class="flex flex-col justify-center gap-4 sm:flex-row">
      <UiButton
        :to="contactHref"
        size="lg"
      >
        Book a scoping call
      </UiButton>
      <UiButton
        :to="contactHref"
        variant="light"
        size="lg"
      >
        Send us a brief
      </UiButton>
    </div>
  </div>
</template>
