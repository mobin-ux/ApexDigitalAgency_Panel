<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/** UI/UX: a three-step checkout prototype with the drop-off flagged, and a test round. */
defineProps<{ visual: HeroVisual }>()

const testers = [
  { id: 'P1', passed: true },
  { id: 'P2', passed: true },
  { id: 'P3', passed: false },
  { id: 'P4', passed: true },
  { id: 'P5', passed: true },
]
</script>

<template>
  <div>
    <ServiceVisualWindow
      :url="visual.url"
      :metric-label="visual.metricLabel"
      :metric="visual.metric"
    >
      <div class="relative flex flex-col gap-3 bg-page bg-[radial-gradient(rgb(16_24_40/0.1)_1px,transparent_1px)] bg-size-[14px_14px] px-4.5 pt-4 pb-4.5">
        <ServiceVisualHeading
          title="Checkout flow · v2"
          chip="Prototype"
        />

        <div class="flex items-start gap-1.5">
          <div class="flex flex-1 flex-col gap-1.25">
            <span class="text-[0.59375rem] font-bold text-muted">1 Basket</span>
            <span class="flex h-34.5 flex-col gap-1.5 rounded-[12px] border border-skeleton-strong bg-white p-2.25">
              <span class="block h-6.5 rounded-[6px] bg-violet-50" />
              <span class="block h-1.25 w-[80%] rounded-[3px] bg-skeleton" />
              <span class="block h-6.5 rounded-[6px] bg-chip" />
              <span class="block h-1.25 w-[60%] rounded-[3px] bg-skeleton" />
              <span class="mt-auto block h-4 rounded-[5px] bg-heading" />
            </span>
          </div>

          <span class="mt-3.5 text-[0.8125rem] font-bold text-violet-500">→</span>

          <div class="relative flex flex-1 flex-col gap-1.25">
            <span class="text-[0.59375rem] font-bold text-amber-800">2 Details</span>
            <span class="flex h-34.5 flex-col gap-1.5 rounded-[12px] border-[1.5px] border-dashed border-amber-400 bg-white p-2.25">
              <span class="block h-1.25 w-1/2 rounded-[3px] bg-skeleton" />
              <span class="block h-3.5 rounded-[5px] border border-skeleton-strong" />
              <span class="block h-1.25 w-1/2 rounded-[3px] bg-skeleton" />
              <span class="block h-3.5 rounded-[5px] border-[1.5px] border-amber-400 bg-amber-50" />
              <span class="mt-auto block h-4 rounded-[5px] bg-heading" />
            </span>
            <span class="absolute -right-3.5 -bottom-3.5 -left-3.5 -rotate-2 rounded-[9px] border border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.59375rem] leading-[1.35] font-semibold text-amber-800 shadow-[0_8px_18px_rgb(180_114_10/0.14)]">38% leave at the postcode field</span>
          </div>

          <span class="mt-3.5 text-[0.8125rem] font-bold text-violet-500">→</span>

          <div class="flex flex-1 flex-col gap-1.25">
            <span class="text-[0.59375rem] font-bold text-muted">3 Payment</span>
            <span class="relative flex h-34.5 flex-col gap-1.5 rounded-[12px] border border-skeleton-strong bg-white p-2.25">
              <span class="block h-7.5 rounded-[7px] bg-linear-150 from-violet-400 to-violet-600" />
              <span class="block h-3.5 rounded-[5px] border border-skeleton-strong" />
              <span class="block h-1.25 w-[70%] rounded-[3px] bg-skeleton" />
              <span class="mt-auto block h-4 rounded-[5px] bg-violet-500" />
              <span class="absolute right-6.5 bottom-1.5 hidden size-5.5 rounded-full bg-violet-500 motion-safe:block motion-safe:animate-ping-soft" />
              <svg
                width="14"
                height="16"
                viewBox="0 0 14 16"
                class="absolute right-5.5 bottom-0.5 block text-heading"
              >
                <path
                  d="M1 1 L1 13 L4.5 10 L7 15 L9 14 L6.5 9 L11 9 Z"
                  fill="currentColor"
                  stroke="white"
                  stroke-width="1.2"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <template #metric-aside>
        <span class="text-[0.71875rem] text-muted line-through">52%</span>
      </template>
      <template #chart>
        <div class="flex w-32.5 flex-col gap-1.5">
          <span class="flex items-center gap-1.5 text-[0.59375rem] text-muted">
            <span class="w-7.5">Before</span>
            <span class="block h-1.75 flex-1 overflow-hidden rounded-full bg-chip">
              <span class="block h-full w-[52%] bg-line-dashed" />
            </span>
          </span>
          <span class="flex items-center gap-1.5 text-[0.59375rem] font-bold text-violet-600">
            <span class="w-7.5">After</span>
            <span class="block h-1.75 flex-1 overflow-hidden rounded-full bg-violet-50">
              <span class="block h-full w-[71%] origin-left rounded-full bg-violet-500 motion-safe:animate-fill-loop" />
            </span>
          </span>
        </div>
      </template>
    </ServiceVisualWindow>

    <ServiceVisualToast
      class="top-24 -right-3.5"
      :title="visual.toastTitle"
      :sub="visual.toastSub"
    />

    <ServiceVisualCard
      title="Test round 2"
      aside="5 real users"
    >
      <span class="grid grid-cols-5 gap-1.5">
        <span
          v-for="tester in testers"
          :key="tester.id"
          class="flex flex-col items-center gap-1.25"
        >
          <span class="inline-flex size-8 items-center justify-center rounded-full bg-chip text-[0.65625rem] font-bold text-body">{{ tester.id }}</span>
          <span
            class="inline-flex size-4.5 items-center justify-center rounded-full text-[0.59375rem] font-extrabold"
            :class="tester.passed ? 'bg-success-50 text-success-ink' : 'bg-amber-50 text-amber-800'"
          >{{ tester.passed ? '✓' : '✕' }}</span>
        </span>
      </span>
      <span class="border-t border-line-soft pt-2.25 text-[0.6875rem] leading-[1.45] text-muted">4 of 5 finished checkout unaided. One fix left before hand-over.</span>
    </ServiceVisualCard>
  </div>
</template>
