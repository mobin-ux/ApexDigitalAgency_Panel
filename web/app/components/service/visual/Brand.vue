<script setup lang="ts">
import type { HeroVisual } from '~/data/service-pages/types'

/** Branding: three logo directions for a sample client, its palette, and the file pack. */
defineProps<{ visual: HeroVisual }>()

// The sample client's palette, labelled with the values the swatches use.
const swatches = [
  { hex: '#1E1B4B', tone: 'bg-indigo-950 text-white' },
  { hex: '#7D53F2', tone: 'bg-violet-500 text-white' },
  { hex: '#F5A524', tone: 'bg-amber-400 text-heading' },
  { hex: '#F4F1FE', tone: 'bg-lilac-50 text-heading' },
] as const

const files = ['SVG', 'PNG', 'PDF', 'EPS', 'JPG', 'Favicon', 'Social', 'Print']
</script>

<template>
  <div>
    <ServiceVisualWindow
      :url="visual.url"
      :metric-label="visual.metricLabel"
      :metric="visual.metric"
    >
      <div class="flex flex-col gap-3.5 px-4.5 pt-4 pb-4.5">
        <ServiceVisualHeading
          label="Brand directions"
          title="Kestrel Electrical"
          chip="3 options"
        />

        <div class="grid grid-cols-3 gap-2">
          <div class="flex flex-col gap-1.5">
            <span class="flex h-21 items-center justify-center rounded-[12px] bg-chip font-serif text-[1.875rem] text-muted italic">K</span>
            <span class="text-[0.65625rem] text-muted">A · Heritage</span>
          </div>
          <div class="relative flex flex-col gap-1.5">
            <span class="flex h-21 items-center justify-center gap-px rounded-[12px] border-[1.5px] border-violet-500 bg-indigo-950 shadow-[0_0_0_4px_rgb(125_83_242/0.14)]">
              <span class="font-display text-[1.875rem] font-extrabold tracking-[-0.04em] text-white">k</span>
              <span class="mt-3 block size-2.25 rounded-full bg-amber-400" />
            </span>
            <span class="text-[0.65625rem] font-bold text-violet-600">B · Bold</span>
            <span class="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full border-2 border-white bg-violet-500 text-[0.625rem] text-white">✓</span>
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="flex h-21 items-center justify-center rounded-[12px] bg-chip font-mono text-[1.375rem] font-bold tracking-[0.08em] text-muted">KE</span>
            <span class="text-[0.65625rem] text-muted">C · Technical</span>
          </div>
        </div>

        <div class="grid grid-cols-[minmax(0,1fr)_92px] gap-2.5">
          <div class="grid grid-cols-4 gap-1.25">
            <span
              v-for="swatch in swatches"
              :key="swatch.hex"
              class="flex h-12.5 items-end rounded-[9px] border border-heading/6 px-1.5 py-1.25 font-mono text-[0.5rem]"
              :class="swatch.tone"
            >{{ swatch.hex }}</span>
          </div>
          <div class="flex flex-col justify-center rounded-[9px] bg-subtle px-2.25 py-1.5">
            <span class="font-display text-2xl leading-none font-extrabold tracking-[-0.03em] text-heading">Aa</span>
            <span class="mt-0.75 text-[0.5625rem] text-muted">Display · Body</span>
          </div>
        </div>
      </div>

      <template #chart>
        <div class="flex items-center gap-1.5 font-display text-[0.8125rem] font-extrabold">
          <span class="flex h-7.5 w-11.5 -rotate-4 items-center justify-center rounded-[6px] bg-indigo-950 text-white">k<span class="ml-px block size-1.25 rounded-full bg-amber-400" /></span>
          <span class="flex size-7.5 items-center justify-center rounded-full bg-violet-500 text-white">k</span>
          <span class="flex h-7.5 w-11.5 rotate-4 items-center justify-center rounded-[6px] border border-skeleton-strong bg-white text-indigo-950">k<span class="ml-px block size-1.25 rounded-full bg-amber-400" /></span>
        </div>
      </template>
    </ServiceVisualWindow>

    <ServiceVisualToast
      class="top-24 -right-3.5"
      :title="visual.toastTitle"
      :sub="visual.toastSub"
    />

    <ServiceVisualCard
      title="Your brand pack"
      aside="Guidelines · 24 pp"
    >
      <span class="flex flex-wrap gap-1.25">
        <span
          v-for="file in files"
          :key="file"
          class="rounded-[7px] border border-line bg-subtle px-2 py-0.75 font-mono text-[0.625rem] font-semibold text-heading"
        >{{ file }}</span>
      </span>
      <span class="border-t border-line-soft pt-2.25 text-[0.6875rem] leading-[1.45] text-muted">Ready for the van, the invoice and the website.</span>
    </ServiceVisualCard>
  </div>
</template>
