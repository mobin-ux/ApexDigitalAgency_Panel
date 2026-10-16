<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/** Software: an internal quote builder, and the sprint plan that shipped it. */
defineProps<{ visual: HeroVisual }>()

const lines = [
  { item: 'Consumer unit upgrade', qty: 1, price: '£480' },
  { item: 'Additional sockets', qty: 6, price: '£270' },
  { item: 'EICR certificate', qty: 1, price: '£150' },
]

const bars = [
  { h: 'h-3', tone: 'bg-violet-150', delay: '[animation-delay:0ms]' },
  { h: 'h-4.5', tone: 'bg-violet-150', delay: '[animation-delay:140ms]' },
  { h: 'h-6', tone: 'bg-violet-400', delay: '[animation-delay:280ms]' },
  { h: 'h-7.75', tone: 'bg-violet-500', delay: '[animation-delay:420ms]' },
  { h: 'h-10', tone: 'bg-violet-500', delay: '[animation-delay:560ms]' },
] as const

// Discovery and three sprints done, the fourth in progress, two to come.
const sprints = [
  { label: 'D', state: 'done' },
  { label: '1', state: 'done' },
  { label: '2', state: 'done' },
  { label: '3', state: 'done' },
  { label: '4', state: 'now' },
  { label: '5', state: 'next' },
  { label: '6', state: 'next' },
] as const

const sprintTones = {
  done: 'bg-success-ink text-white',
  now: 'bg-violet-500 text-white motion-safe:animate-pulse-ring',
  next: 'bg-chip text-muted',
} as const
</script>

<template>
  <div>
    <ServiceVisualWindow
      :url="visual.url"
      :metric-label="visual.metricLabel"
      :metric="visual.metric"
    >
      <div class="grid grid-cols-[52px_minmax(0,1fr)]">
        <div class="flex flex-col items-center gap-3 bg-heading py-4">
          <span class="block size-5.5 rounded-[7px] bg-linear-150 from-violet-400 to-violet-600" />
          <span
            v-for="n in 4"
            :key="n"
            class="flex size-6.5 items-center justify-center rounded-[8px]"
            :class="n === 2 ? 'bg-violet-400/30' : 'bg-white/8'"
          >
            <span
              class="block h-0.75 w-3 rounded-[2px]"
              :class="n === 2 ? 'bg-white' : 'bg-white/45'"
            />
          </span>
        </div>

        <div class="flex flex-col gap-3 px-4.5 py-4">
          <ServiceVisualHeading
            label="Quote builder"
            title="Q-1042 · Mrs Patel, Ashford"
            chip="Draft"
          />

          <div class="flex flex-col overflow-hidden rounded-[12px] border border-line">
            <div class="grid grid-cols-[minmax(0,1fr)_28px_50px] gap-2 bg-subtle px-2.5 py-1.75 text-[0.59375rem] font-bold tracking-[0.04em] text-muted uppercase">
              <span>Item</span>
              <span class="text-center">Qty</span>
              <span class="text-right">Price</span>
            </div>
            <div
              v-for="line in lines"
              :key="line.item"
              class="grid grid-cols-[minmax(0,1fr)_28px_50px] gap-2 border-t border-line-soft px-2.5 py-2 text-[0.71875rem] text-heading"
            >
              <span class="truncate">{{ line.item }}</span>
              <span class="text-center text-muted">{{ line.qty }}</span>
              <span class="text-right font-semibold">{{ line.price }}</span>
            </div>
            <div class="flex items-center border-t border-line px-2.5 py-2.25 text-[0.71875rem]">
              <span class="text-muted">Total inc. VAT</span>
              <span class="ml-auto font-display text-[0.9375rem] font-extrabold text-heading">£1,080</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[0.65625rem] text-muted">Built in 40 seconds, not 40 minutes</span>
            <span class="ml-auto rounded-[9px] bg-violet-500 px-2.75 py-1.5 text-[0.6875rem] font-bold text-white motion-safe:animate-pulse-ring">Send to customer</span>
          </div>
        </div>
      </div>

      <template #chart>
        <div class="flex h-10 items-end gap-1.75">
          <span
            v-for="bar in bars"
            :key="bar.delay"
            class="block w-2.5 origin-bottom rounded-[3px] motion-safe:animate-grow-loop"
            :class="[bar.h, bar.tone, bar.delay]"
          />
        </div>
      </template>
    </ServiceVisualWindow>

    <ServiceVisualToast
      class="top-24 -right-3.5"
      :title="visual.toastTitle"
      :sub="visual.toastSub"
    />

    <ServiceVisualCard
      title="Sprint plan"
      aside="Demo every 2 weeks"
    >
      <span class="grid grid-cols-7 gap-1.25">
        <span
          v-for="sprint in sprints"
          :key="sprint.label"
          class="flex h-6.5 items-center justify-center rounded-[8px] text-[0.6875rem] font-bold"
          :class="sprintTones[sprint.state]"
        >{{ sprint.label }}</span>
      </span>
      <span class="flex items-center gap-2 border-t border-line-soft pt-2.25 text-[0.6875rem] text-muted">
        <span class="rounded-[6px] bg-subtle px-1.75 py-0.75 font-mono text-[0.625rem] text-heading">main · v1.4.0</span>
        Your repo, your IP
      </span>
    </ServiceVisualCard>
  </div>
</template>
