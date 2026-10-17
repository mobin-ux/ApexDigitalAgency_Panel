<script setup lang="ts">
import type { CaseStudyStory } from '~/data/case-studies'

/**
 * Monthly bar chart, before and after launch.
 *
 * The strict CSP blocks style attributes, so a bar's height is a class:
 * `h-[N%]` for whole percents, which `main.css` generates with
 * `@source inline`. The bars are decorative; the same figures are in a table
 * for screen readers.
 */
const props = defineProps<{ chart: NonNullable<CaseStudyStory['outcome']['chart']> }>()

// Headroom above the tallest bar for its label, as in the design (31 of 34).
const scale = Math.max(...props.chart.points.map(point => point.value)) * 1.1

const bars = props.chart.points.map((point, i) => ({
  ...point,
  after: i >= props.chart.launchIndex,
  launch: i === props.chart.launchIndex,
  height: `h-[${Math.max(1, Math.round(point.value / scale * 100))}%]`,
}))
</script>

<template>
  <figure class="mt-1.5 flex flex-col gap-6 rounded-2xl border border-line bg-white px-5 pt-7 pb-6 shadow-tile sm:px-7.5">
    <figcaption class="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span class="font-display text-[1.0625rem] font-semibold tracking-[-0.015em] text-heading">{{ chart.title }}</span>
      <span
        class="flex items-center gap-5 sm:ml-auto"
        aria-hidden="true"
      >
        <span class="flex items-center gap-2 text-[0.8125rem] whitespace-nowrap text-body">
          <span class="size-2.5 rounded-[3px] bg-line-strong" />Before
        </span>
        <span class="flex items-center gap-2 text-[0.8125rem] whitespace-nowrap text-body">
          <span class="size-2.5 rounded-[3px] bg-violet-500" />After launch
        </span>
      </span>
    </figcaption>

    <div aria-hidden="true">
      <div class="grid h-55 grid-cols-12 items-end gap-1.5 border-b border-line sm:gap-2.5">
        <div
          v-for="bar in bars"
          :key="bar.month"
          class="flex h-full flex-col items-center justify-end gap-2"
        >
          <span
            class="text-xs font-bold"
            :class="bar.after ? 'text-heading' : 'text-muted'"
          >{{ bar.value }}</span>
          <span
            class="w-full rounded-t-lg"
            :class="[bar.height, bar.after ? 'bg-violet-500' : 'bg-line-strong']"
          />
        </div>
      </div>
      <div class="mt-3 grid grid-cols-12 gap-1.5 sm:gap-2.5">
        <span
          v-for="bar in bars"
          :key="bar.month"
          class="text-center text-xs"
          :class="bar.launch ? 'font-bold text-violet-600' : 'font-medium text-muted'"
        >{{ bar.month }}</span>
      </div>
    </div>

    <table class="sr-only">
      <caption>{{ chart.title }}, launch in {{ chart.points[chart.launchIndex]?.month }}</caption>
      <thead>
        <tr>
          <th scope="col">
            Month
          </th>
          <th scope="col">
            Requests
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="bar in bars"
          :key="bar.month"
        >
          <th scope="row">
            {{ bar.month }}{{ bar.launch ? ' (launch)' : '' }}
          </th>
          <td>{{ bar.value }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
