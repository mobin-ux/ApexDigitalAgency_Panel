<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/** PPC: a live search campaign, its ad, the impressions-to-leads funnel and cost per lead. */
defineProps<{ visual: HeroVisual }>()

const funnel = [
  { label: 'Impressions', value: '18.4k', width: 'w-full', tone: 'bg-violet-150', delay: '[animation-delay:0ms]' },
  { label: 'Clicks', value: '1,206', width: 'w-[58%]', tone: 'bg-violet-400', delay: '[animation-delay:200ms]' },
  { label: 'Leads', value: '46', width: 'w-[24%]', tone: 'bg-violet-500', delay: '[animation-delay:400ms]' },
] as const

const week = [
  { day: 'M', h: 'h-3.5', tone: 'bg-violet-150', delay: '[animation-delay:0ms]' },
  { day: 'T', h: 'h-5', tone: 'bg-violet-150', delay: '[animation-delay:120ms]' },
  { day: 'W', h: 'h-4.25', tone: 'bg-violet-400', delay: '[animation-delay:240ms]' },
  { day: 'T', h: 'h-6', tone: 'bg-violet-400', delay: '[animation-delay:360ms]' },
  { day: 'F', h: 'h-7', tone: 'bg-violet-500', delay: '[animation-delay:480ms]' },
] as const

const spend = [
  { label: 'Google', share: '62%', width: 'w-[62%]', tone: 'bg-violet-500' },
  { label: 'Meta', share: '27%', width: 'w-[27%]', tone: 'bg-violet-400' },
  { label: 'LinkedIn', share: '11%', width: 'w-[11%]', tone: 'bg-violet-150' },
] as const
</script>

<template>
  <div>
    <ServiceVisualWindow
      :url="visual.url"
      :metric-label="visual.metricLabel"
      :metric="visual.metric"
    >
      <div class="flex flex-col gap-3.5 px-5 pt-4.5 pb-4">
        <ServiceVisualHeading
          label="Campaign"
          title="Emergency callouts · Kent"
        >
          <span class="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-[0.6875rem] font-bold text-success-ink">
            <span class="block size-1.75 rounded-full bg-success motion-safe:animate-live" />
            Live
          </span>
        </ServiceVisualHeading>

        <div class="flex flex-col gap-1.25 rounded-md border-[1.5px] border-violet-400 px-3.5 py-3 shadow-[0_10px_26px_rgb(125_83_242/0.14)]">
          <span class="flex items-center gap-1.75 text-[0.65625rem] text-muted"><span class="font-extrabold text-heading">Sponsored</span>yourbusiness.co.uk</span>
          <span class="font-display text-[0.84375rem] font-bold tracking-[-0.01em] text-violet-600">Electrician Today | Fixed Callout From £65</span>
          <span class="mt-0.5 block h-1.5 w-[88%] rounded-[3px] bg-skeleton" />
          <span class="mt-1.25 flex gap-1.5 text-[0.65625rem]">
            <span class="rounded-full bg-violet-50 px-2.25 py-0.75 font-bold text-violet-600">Call now</span>
            <span class="rounded-full bg-chip px-2.25 py-0.75 font-semibold text-body">Get a quote</span>
            <span class="rounded-full bg-chip px-2.25 py-0.75 font-semibold text-body">Reviews</span>
          </span>
        </div>

        <div class="flex flex-col gap-2.25">
          <div
            v-for="row in funnel"
            :key="row.label"
            class="grid grid-cols-[74px_minmax(0,1fr)_44px] items-center gap-2.5 text-[0.71875rem]"
          >
            <span class="text-muted">{{ row.label }}</span>
            <span class="block h-2.5 overflow-hidden rounded-full bg-chip">
              <span
                class="block h-full origin-left rounded-full motion-safe:animate-fill-loop"
                :class="[row.width, row.tone, row.delay]"
              />
            </span>
            <span class="text-right font-bold text-heading">{{ row.value }}</span>
          </div>
        </div>
      </div>

      <template #chart>
        <div class="flex h-10 items-end gap-1.5">
          <span
            v-for="bar in week"
            :key="bar.delay"
            class="flex flex-col items-center gap-0.75"
          >
            <span
              class="block w-3 origin-bottom rounded-[3px] motion-safe:animate-grow-loop"
              :class="[bar.h, bar.tone, bar.delay]"
            />
            <span class="text-[0.53125rem] text-muted">{{ bar.day }}</span>
          </span>
        </div>
      </template>
    </ServiceVisualWindow>

    <ServiceVisualToast
      class="top-24 -right-3.5"
      icon="☎"
      tone="violet"
      :title="visual.toastTitle"
      :sub="visual.toastSub"
    />

    <ServiceVisualCard
      v-if="visual.card"
      dense
    >
      <span class="text-[0.78125rem] text-muted">{{ visual.card.label }}</span>
      <span class="flex items-baseline gap-2">
        <span class="font-display text-[1.875rem] leading-none font-extrabold tracking-[-0.028em] text-heading">
          {{ visual.card.value }}<span class="text-[0.84375rem] font-semibold text-muted">{{ visual.card.unit }}</span>
        </span>
        <span
          v-if="visual.card.change"
          class="ml-auto rounded-full bg-success-50 px-2 py-0.5 text-[0.6875rem] font-bold text-success-ink"
        >{{ visual.card.change }}</span>
      </span>
      <span class="text-[0.71875rem] leading-normal text-muted">{{ visual.card.note }}</span>
      <span class="flex flex-col gap-1.5 border-t border-line-soft pt-2">
        <span class="text-[0.6875rem] text-muted">Spend by channel</span>
        <span class="flex h-2 gap-0.5 overflow-hidden rounded-full">
          <span
            v-for="channel in spend"
            :key="channel.label"
            class="block"
            :class="[channel.width, channel.tone]"
          />
        </span>
        <span class="flex gap-2.5 text-[0.65625rem] text-muted">
          <span
            v-for="channel in spend"
            :key="channel.label"
          >{{ channel.label }} {{ channel.share }}</span>
        </span>
      </span>
    </ServiceVisualCard>
  </div>
</template>
