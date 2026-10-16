<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/** SEO: a local search with the map pack and the client's listing climbing to #2. */
defineProps<{ visual: HeroVisual }>()

const positions = [
  { query: 'electrician maidstone', from: 14, to: 2 },
  { query: 'emergency electrician kent', from: 22, to: 5 },
  { query: 'ev charger fitting', from: 31, to: 8 },
]
</script>

<template>
  <div>
    <ServiceVisualWindow
      :url="visual.url"
      :metric-label="visual.metricLabel"
      :metric="visual.metric"
    >
      <div class="flex flex-col gap-3.5 px-5 pt-4.5 pb-4">
        <div class="flex items-center gap-2.5 rounded-full border border-skeleton-strong px-3.5 py-2.25 shadow-[0_2px_8px_rgb(17_31_34/0.05)]">
          <span class="block size-3 flex-none rounded-full border-2 border-violet-500" />
          <span class="text-[0.8125rem] font-semibold text-heading">electrician maidstone</span>
          <span class="-ml-1.5 block h-3.5 w-[1.5px] bg-violet-500 motion-safe:animate-caret" />
          <span class="ml-auto text-[0.65625rem] text-muted">Near you</span>
        </div>

        <div class="relative h-23 overflow-hidden rounded-md bg-lilac-50 bg-[linear-gradient(rgb(125_83_242/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(125_83_242/0.07)_1px,transparent_1px)] bg-size-[22px_22px]">
          <span class="absolute top-13 -left-2.5 block h-2.25 w-110 -rotate-8 bg-white" />
          <span class="absolute -top-5 left-42.5 block h-35 w-2 rotate-18 bg-white" />
          <span class="absolute top-6.5 left-17.5 block size-3 -rotate-45 rounded-[999px_999px_999px_0] bg-line-dashed" />
          <span class="absolute top-14 left-71.5 block size-3 -rotate-45 rounded-[999px_999px_999px_0] bg-line-dashed" />
          <span class="absolute top-7.5 left-49 hidden size-6.5 rounded-full bg-violet-500 motion-safe:block motion-safe:animate-ping-soft" />
          <span class="absolute top-6.5 left-50 block size-4.5 -rotate-45 rounded-[999px_999px_999px_0] border-2 border-white bg-violet-500 shadow-[0_4px_10px_rgb(108_64_232/0.35)]" />
          <span class="absolute right-2.5 bottom-2.25 rounded-full bg-white px-2.25 py-0.75 text-[0.625rem] font-bold text-violet-600">Map pack · 1 of 3</span>
        </div>

        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2.5 rounded-[12px] bg-subtle px-3 py-2.25">
            <span class="text-[0.6875rem] font-bold text-muted">1</span>
            <span class="flex flex-col gap-1.25">
              <span class="block h-1.25 w-[34%] rounded-[3px] bg-line-strong" />
              <span class="block h-2 w-[78%] rounded-[3px] bg-skeleton-dark" />
            </span>
          </div>
          <div class="relative z-1 grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2.5 rounded-[12px] border-[1.5px] border-violet-400 bg-white px-3 py-2.5 motion-safe:animate-rank-rise">
            <span class="inline-flex size-5 items-center justify-center rounded-full bg-violet-500 text-[0.6875rem] font-extrabold text-white">2</span>
            <span class="flex min-w-0 flex-col gap-0.75">
              <span class="text-[0.65625rem] text-muted">yourbusiness.co.uk › electrician</span>
              <span class="truncate font-display text-[0.8125rem] font-bold tracking-[-0.01em] text-violet-600">Electrician in Maidstone | 24/7 Callouts</span>
              <span class="flex items-center gap-1.5 text-[0.65625rem] text-muted">
                <UiStars class="text-amber-400" />
                4.9 · 212 reviews
              </span>
            </span>
          </div>
          <div class="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2.5 rounded-[12px] bg-subtle px-3 py-2.25 motion-safe:animate-rank-drop">
            <span class="text-[0.6875rem] font-bold text-muted">3</span>
            <span class="flex flex-col gap-1.25">
              <span class="block h-1.25 w-[28%] rounded-[3px] bg-line-strong" />
              <span class="block h-2 w-[66%] rounded-[3px] bg-skeleton-dark" />
            </span>
          </div>
        </div>
      </div>

      <template #chart>
        <svg
          width="132"
          height="40"
          viewBox="0 0 132 40"
          class="block text-violet-500"
        >
          <path
            d="M2 36 L22 33 L42 34 L62 26 L82 22 L102 12 L130 4 L130 40 L2 40 Z"
            fill="currentColor"
            fill-opacity="0.1"
          />
          <path
            d="M2 36 L22 33 L42 34 L62 26 L82 22 L102 12 L130 4"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            cx="130"
            cy="4"
            r="3.5"
            fill="currentColor"
          />
        </svg>
      </template>
    </ServiceVisualWindow>

    <ServiceVisualToast
      class="top-30 -right-3.5"
      icon="↑"
      :title="visual.toastTitle"
      :sub="visual.toastSub"
    />

    <ServiceVisualCard
      title="Keyword positions"
      aside="90 days"
      dense
    >
      <span
        v-for="row in positions"
        :key="row.query"
        class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-xs"
      >
        <span class="truncate text-heading">{{ row.query }}</span>
        <span class="text-muted line-through">{{ row.from }}</span>
        <span class="min-w-10 rounded-full bg-success-50 px-1.75 py-0.5 text-center font-bold text-success-ink">↑ {{ row.to }}</span>
      </span>
    </ServiceVisualCard>
  </div>
</template>
