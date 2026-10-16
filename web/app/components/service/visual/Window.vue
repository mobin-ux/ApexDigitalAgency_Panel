<script setup lang="ts">
/**
 * The browser window each service's hero drawing is built in: address bar,
 * a body the drawing fills, and a footer with the headline metric. The
 * caller positions it.
 */
defineProps<{
  url: string
  metricLabel: string
  metric: string
}>()
</script>

<template>
  <div class="absolute top-0 left-15.5 w-101 overflow-hidden rounded-2xl border border-line bg-white shadow-float motion-safe:animate-drift-a">
    <div class="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5">
      <span class="flex gap-1.25">
        <span
          v-for="n in 3"
          :key="n"
          class="block size-2 rounded-full bg-skeleton-strong"
        />
      </span>
      <span class="flex-1 rounded-full bg-subtle px-3 py-1.25 text-[0.71875rem] text-muted">{{ url }}</span>
    </div>

    <slot />

    <div class="flex items-end gap-5 border-t border-line-soft px-5 pt-3 pb-4">
      <div class="flex flex-col gap-1.25">
        <span class="text-xs text-muted">{{ metricLabel }}</span>
        <span class="flex items-baseline gap-2">
          <span class="font-display text-[1.625rem] leading-none font-extrabold tracking-[-0.026em] text-heading">{{ metric }}</span>
          <slot name="metric-aside" />
        </span>
      </div>
      <div class="ml-auto">
        <slot name="chart" />
      </div>
    </div>
  </div>
</template>
