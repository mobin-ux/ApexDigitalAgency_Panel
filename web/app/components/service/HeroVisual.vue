<script setup lang="ts">
import type { ServicePageContent } from '~/data/service-pages/types'
import { defaultPlanTerm } from '~/data/plans'

/**
 * Decorative composition beside the service hero: a browser window with an
 * example metric, a notification and the plan card. It illustrates the offer
 * rather than reporting anyone's data, so it is hidden from assistive tech,
 * and below `sm` the copy and calls to action own the first viewport.
 */
defineProps<{ visual: ServicePageContent['visual'] }>()

const bars = [
  { h: 'h-4', tone: 'bg-violet-150', delay: '[animation-delay:0ms]' },
  { h: 'h-5.25', tone: 'bg-violet-150', delay: '[animation-delay:140ms]' },
  { h: 'h-4.75', tone: 'bg-violet-400', delay: '[animation-delay:280ms]' },
  { h: 'h-6.75', tone: 'bg-violet-400', delay: '[animation-delay:420ms]' },
  { h: 'h-8.75', tone: 'bg-violet-500', delay: '[animation-delay:560ms]' },
  { h: 'h-11', tone: 'bg-violet-500', delay: '[animation-delay:700ms]' },
] as const

// Three instalments shown as paid, the fourth filling in.
const paid = 3
</script>

<template>
  <div
    class="relative mx-auto hidden h-140 w-120 sm:block"
    aria-hidden="true"
  >
    <div class="absolute top-11.5 left-26 size-84 rounded-full bg-[radial-gradient(circle_at_50%_38%,var(--color-violet-400)_0%,var(--color-violet-500)_55%,var(--color-violet-600)_100%)] shadow-blob motion-safe:animate-blob" />

    <!-- Browser window -->
    <div class="absolute top-4 left-19.5 w-94.5 overflow-hidden rounded-2xl border border-line bg-white shadow-float motion-safe:animate-drift-a">
      <div class="flex items-center gap-2.5 border-b border-line-soft px-4 py-3.5">
        <span class="flex gap-1.25">
          <span
            v-for="n in 3"
            :key="n"
            class="block size-2 rounded-full bg-skeleton-strong"
          />
        </span>
        <span class="flex-1 rounded-full bg-subtle px-3 py-1.25 text-[0.71875rem] text-muted">{{ visual.url }}</span>
      </div>

      <div class="flex flex-col gap-4.5 p-6">
        <div class="flex items-center gap-2">
          <span class="block h-2 w-6 rounded-[3px] bg-heading" />
          <span class="ml-auto flex items-center gap-1.75">
            <span class="block h-1.5 w-7 rounded-[3px] bg-skeleton" />
            <span class="block h-1.5 w-7 rounded-[3px] bg-skeleton" />
            <span class="block h-3.75 w-9.5 rounded-full bg-violet-500" />
          </span>
        </div>
        <div class="grid grid-cols-[1fr_100px] items-center gap-4.5">
          <div class="flex flex-col gap-2">
            <span class="block h-3.5 w-[92%] rounded-[4px] bg-heading" />
            <span class="block h-3.5 w-[62%] rounded-[4px] bg-heading" />
            <span class="mt-1 block h-1.5 w-[84%] rounded-[3px] bg-skeleton" />
            <span class="mt-1.5 block h-6 w-20.5 rounded-sm bg-violet-500 motion-safe:animate-pulse-ring" />
          </div>
          <span class="block h-25 rounded-lg bg-linear-150 from-violet-400 to-violet-600" />
        </div>
        <div class="grid grid-cols-3 gap-2.5">
          <span
            v-for="n in 3"
            :key="n"
            class="block h-11.5 rounded-sm bg-chip"
          />
        </div>
      </div>

      <div class="flex items-end gap-5 border-t border-line-soft px-6 pt-3.5 pb-4.5">
        <div class="flex flex-col gap-1.25">
          <span class="text-xs text-muted">{{ visual.metricLabel }}</span>
          <span class="font-display text-[1.625rem] leading-none font-extrabold tracking-[-0.026em] text-heading">{{ visual.metric }}</span>
        </div>
        <div class="ml-auto flex h-11 items-end gap-1.75">
          <span
            v-for="bar in bars"
            :key="bar.delay"
            class="block w-2.5 origin-bottom rounded-[3px] motion-safe:animate-grow-loop"
            :class="[bar.h, bar.tone, bar.delay]"
          />
        </div>
      </div>
    </div>

    <!-- Notification -->
    <div class="absolute top-15.5 right-1 flex items-center gap-2.75 rounded-lg border border-line bg-white px-4 py-3 shadow-toast motion-safe:animate-toast">
      <span class="inline-flex size-6.5 flex-none items-center justify-center rounded-full bg-success-50 text-xs text-success">✓</span>
      <span class="flex flex-col gap-0.5">
        <span class="font-display text-[0.84375rem] font-semibold tracking-[-0.01em] text-heading">{{ visual.toastTitle }}</span>
        <span class="text-[0.71875rem] text-muted">{{ visual.toastSub }}</span>
      </span>
    </div>

    <!-- Plan card -->
    <div class="absolute bottom-5.5 -left-10 flex w-60 flex-col gap-2.75 rounded-xl border border-line bg-white px-5 py-4.5 shadow-[0_28px_60px_rgb(17_31_34/0.16)] motion-safe:animate-drift-c">
      <span class="text-[0.78125rem] text-muted">{{ visual.cardLabel }}</span>
      <span class="font-display text-[1.875rem] leading-none font-extrabold tracking-[-0.028em] text-heading">
        {{ visual.cardValue }}<span class="text-[0.84375rem] font-semibold text-muted">{{ visual.cardUnit }}</span>
      </span>
      <span class="flex items-center justify-between gap-1">
        <span
          v-for="n in defaultPlanTerm"
          :key="n"
          class="block size-2 rounded-full"
          :class="n <= paid ? 'bg-violet-500' : n === paid + 1 ? 'bg-violet-100 motion-safe:animate-fill-dot' : 'bg-violet-100'"
        />
      </span>
      <span class="text-[0.71875rem] text-muted">{{ visual.cardNote }}</span>
    </div>
  </div>
</template>
