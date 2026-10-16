<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/** Digital marketing: a fortnight's content calendar, the named marketer and one report across channels. */
defineProps<{ visual: HeroVisual }>()

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const tones = {
  email: 'bg-violet-50 text-violet-600',
  content: 'bg-success-50 text-success-ink',
  social: 'bg-amber-50 text-amber-800',
  ads: 'bg-blue-50 text-blue-700',
  empty: 'bg-subtle',
  live: 'border border-violet-600 bg-violet-500 text-white motion-safe:animate-pulse-ring',
} as const

const calendar: readonly { label: string, tone: keyof typeof tones }[] = [
  { label: 'Email', tone: 'email' },
  { label: '', tone: 'empty' },
  { label: 'Blog', tone: 'content' },
  { label: 'Social', tone: 'social' },
  { label: '', tone: 'empty' },
  { label: 'Social', tone: 'social' },
  { label: 'Ads', tone: 'ads' },
  { label: '', tone: 'empty' },
  { label: 'Newsletter', tone: 'live' },
  { label: 'SEO', tone: 'content' },
]

const channels = [
  { label: 'Search', value: 78, width: 'w-[37%]', tone: 'bg-violet-500' },
  { label: 'Email', value: 41, width: 'w-[19%]', tone: 'bg-violet-400' },
  { label: 'Social', value: 36, width: 'w-[17%]', tone: 'bg-amber-400' },
  { label: 'Ads', value: 29, width: 'w-[14%]', tone: 'bg-blue-500' },
  { label: 'Referral', value: 17, width: 'w-[8%]', tone: 'bg-success' },
  { label: 'Direct', value: 11, width: 'w-[5%]', tone: 'bg-line-dashed' },
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
          label="Monthly plan"
          title="October · weeks 1–2"
        >
          <span class="inline-flex items-center gap-2 rounded-full bg-subtle py-1 pr-2.75 pl-1">
            <span class="inline-flex size-6 items-center justify-center rounded-full bg-linear-150 from-violet-400 to-violet-600 text-[0.625rem] font-extrabold text-white">SM</span>
            <span class="flex flex-col leading-[1.15]">
              <span class="text-[0.6875rem] font-bold text-heading">Sophie M.</span>
              <span class="text-[0.59375rem] text-muted">Your marketer</span>
            </span>
          </span>
        </ServiceVisualHeading>

        <div class="grid grid-cols-5 gap-1.5">
          <span
            v-for="day in days"
            :key="day"
            class="text-center text-[0.625rem] font-semibold text-muted"
          >{{ day }}</span>
          <span
            v-for="(cell, i) in calendar"
            :key="i"
            class="flex h-11.5 items-end overflow-hidden rounded-sm px-1.75 py-1.5 text-[0.625rem] font-bold whitespace-nowrap"
            :class="tones[cell.tone]"
          >{{ cell.label }}</span>
        </div>

        <div class="flex items-center gap-2 text-[0.6875rem] text-muted">
          <span class="inline-flex size-4 items-center justify-center rounded-full bg-success-ink text-[0.5625rem] text-white">✓</span>
          8 of 10 pieces approved before they go out
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
            d="M2 30 L24 32 L46 24 L68 26 L90 16 L110 14 L130 6 L130 40 L2 40 Z"
            fill="currentColor"
            fill-opacity="0.1"
          />
          <path
            d="M2 30 L24 32 L46 24 L68 26 L90 16 L110 14 L130 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            cx="130"
            cy="6"
            r="3.5"
            fill="currentColor"
          />
        </svg>
      </template>
    </ServiceVisualWindow>

    <ServiceVisualToast
      class="top-24 -right-3.5"
      :title="visual.toastTitle"
      :sub="visual.toastSub"
    />

    <ServiceVisualCard
      title="One report, every channel"
      aside="Oct"
      dense
    >
      <span class="flex h-2 gap-0.5 overflow-hidden rounded-full">
        <span
          v-for="channel in channels"
          :key="channel.label"
          class="block"
          :class="[channel.width, channel.tone]"
        />
      </span>
      <span class="grid grid-cols-3 gap-x-2.5 gap-y-1.75">
        <span
          v-for="channel in channels"
          :key="channel.label"
          class="flex items-center gap-1.25 text-[0.65625rem] text-muted"
        >
          <span
            class="block size-1.75 flex-none rounded-full"
            :class="channel.tone"
          />
          {{ channel.label }}
          <span class="ml-auto font-bold text-heading">{{ channel.value }}</span>
        </span>
      </span>
    </ServiceVisualCard>
  </div>
</template>
