<script setup lang="ts">
import type { StoryResult } from '~/data/case-studies'

const props = defineProps<{ results: readonly StoryResult[] }>()

// Column counts are spelled out so Tailwind can see every class.
const columns = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
} as Record<number, string>

const grid = columns[Math.min(props.results.length, 4)]
</script>

<template>
  <section
    aria-labelledby="results-title"
    class="container-page pt-10"
  >
    <h2
      id="results-title"
      class="sr-only"
    >
      Results
    </h2>
    <dl
      class="grid overflow-hidden rounded-2xl border border-line bg-white shadow-card"
      :class="grid"
    >
      <div
        v-for="result in results"
        :key="result.label"
        class="-mt-px -ml-px flex flex-col gap-3 border-t border-l border-line-soft px-7.5 pt-7.5 pb-7"
      >
        <dt class="text-xs font-bold tracking-[0.06em] text-muted uppercase">
          {{ result.label }}
        </dt>
        <dd class="flex flex-col gap-3">
          <span class="flex items-baseline gap-2.5 whitespace-nowrap">
            <span class="sr-only">From</span>
            <span class="font-display text-xl font-semibold tracking-[-0.02em] text-muted">{{ result.before }}</span>
            <span
              class="text-[0.9375rem] text-muted"
              aria-hidden="true"
            >→</span>
            <span class="sr-only">to</span>
            <span class="font-display text-[2.5rem] leading-none font-extrabold tracking-[-0.03em] text-violet-500">{{ result.after }}</span>
          </span>
          <span class="text-[0.84375rem] leading-normal text-body">{{ result.note }}</span>
        </dd>
      </div>
    </dl>
  </section>
</template>
