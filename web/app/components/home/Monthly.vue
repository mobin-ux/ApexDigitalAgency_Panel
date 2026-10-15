<script setup lang="ts">
import { monthlyFinalStep, monthlySteps } from '~/data/home'
</script>

<template>
  <section
    id="monthly"
    aria-labelledby="monthly-title"
    class="bg-page"
  >
    <div class="container-page py-24 lg:py-32">
      <div class="mx-auto mb-12 max-w-180 lg:mb-16">
        <UiSectionHeader
          id="monthly-title"
          eyebrow="Pay monthly"
          title="Professional work without the upfront lump sum"
          align="center"
          balance
        >
          Most of our clients are sole traders and small teams. Spread the cost over twelve months and pay for the project out of the revenue it brings in.
        </UiSectionHeader>
      </div>

      <div class="grid items-start gap-8 lg:grid-cols-[1fr_0.82fr]">
        <HomePlanCalculator hydrate-on-visible />

        <ol class="flex flex-col">
          <li
            v-for="(step, i) in monthlySteps"
            :key="step.title"
            class="flex gap-4.5 pb-6.5"
          >
            <span class="flex flex-col items-center gap-2">
              <span class="inline-flex size-8 flex-none items-center justify-center rounded-full bg-violet-500 font-display text-sm font-extrabold text-white">{{ i + 1 }}</span>
              <span
                class="w-0.5 flex-1 bg-line"
                aria-hidden="true"
              />
            </span>
            <span class="flex flex-col gap-1.5 pt-0.75">
              <span class="font-display text-[1.1875rem] font-semibold tracking-tight text-heading">{{ step.title }}</span>
              <span class="text-[0.9375rem] leading-relaxed text-body">{{ step.body }}</span>
            </span>
          </li>
          <li class="flex gap-4.5">
            <span class="inline-flex size-8 flex-none items-center justify-center rounded-full bg-success text-[0.8125rem] text-white">
              <span aria-hidden="true">✓</span>
              <span class="sr-only">Done:</span>
            </span>
            <span class="flex flex-col gap-1.5 pt-0.75">
              <span class="font-display text-[1.1875rem] font-semibold tracking-tight text-heading">{{ monthlyFinalStep.title }}</span>
              <span class="text-[0.9375rem] leading-relaxed text-body">{{ monthlyFinalStep.body }}</span>
            </span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
