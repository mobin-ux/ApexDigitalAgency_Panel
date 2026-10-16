<script setup lang="ts">
import type { ServiceSlug } from '~/data/routes'

/**
 * The small abstract product drawing at the top of each services page card.
 * Decorative only: the card's heading and copy carry the meaning.
 */
defineProps<{ name: ServiceSlug }>()
</script>

<template>
  <div
    class="flex h-35 items-center justify-center overflow-hidden rounded-lg border border-line-soft bg-subtle"
    aria-hidden="true"
  >
    <!-- Website: a browser window with a headline, a button and an image block -->
    <div
      v-if="name === 'website-design'"
      class="w-54.5 overflow-hidden rounded-[12px] border border-line bg-white shadow-mini"
    >
      <div class="flex gap-1.25 border-b border-line-soft px-3 py-2.25">
        <span
          v-for="n in 3"
          :key="n"
          class="block size-1.25 rounded-full bg-skeleton-strong"
        />
      </div>
      <div class="grid grid-cols-[1fr_52px] items-center gap-3 p-3.5">
        <div class="flex flex-col gap-1.5">
          <span class="block h-2 w-[88%] rounded-[3px] bg-heading" />
          <span class="block h-2 w-[58%] rounded-[3px] bg-heading" />
          <span class="block h-1 w-[74%] rounded-[2px] bg-skeleton" />
          <span class="mt-1 block h-3.5 w-11 rounded-[5px] bg-violet-500" />
        </div>
        <span class="block h-13 rounded-[9px] bg-linear-150 from-violet-400 to-violet-600" />
      </div>
    </div>

    <!-- SEO: a search box over a first-place result -->
    <div
      v-else-if="name === 'seo'"
      class="flex w-53.5 flex-col gap-2"
    >
      <span class="flex items-center gap-2.25 rounded-full border border-line bg-white px-3.25 py-2">
        <span class="block size-2.75 rounded-full border-2 border-violet-500" />
        <span class="block h-1.25 w-24 rounded-[3px] bg-skeleton" />
      </span>
      <span class="flex items-center gap-2.5 rounded-sm border-[1.5px] border-violet-500 bg-white px-3.25 py-2.75 shadow-[0_10px_24px_rgb(125_83_242/0.14)]">
        <span class="inline-flex size-4.5 items-center justify-center rounded-[6px] bg-violet-500 font-display text-[0.625rem] font-semibold text-white">1</span>
        <span class="block h-1.5 w-28 rounded-[3px] bg-heading" />
      </span>
      <span class="flex items-center gap-2.5 px-3.25">
        <span class="block size-4.5 rounded-[6px] bg-skeleton-strong" />
        <span class="block h-1.25 w-21 rounded-[3px] bg-line-strong" />
      </span>
    </div>

    <!-- PPC: a target with a cursor -->
    <span
      v-else-if="name === 'ppc'"
      class="relative block size-26"
    >
      <span class="absolute inset-0 block rounded-full border-[1.5px] border-violet-100" />
      <span class="absolute inset-4.5 block rounded-full border-[1.5px] border-violet-200" />
      <span class="absolute inset-9 block rounded-full bg-violet-500" />
      <span class="absolute right-2 bottom-1.5 block size-0 -rotate-14 border-t-[3px] border-b-[15px] border-l-[10px] border-t-transparent border-b-transparent border-l-heading" />
    </span>

    <!-- Digital marketing: a rising bar chart with an up chip -->
    <div
      v-else-if="name === 'digital-marketing'"
      class="flex flex-col gap-3 rounded-md border border-line bg-white px-5 py-4 shadow-mini"
    >
      <span class="flex items-center gap-2.5">
        <span class="block h-1.25 w-14.5 rounded-[3px] bg-skeleton" />
        <span class="rounded-full bg-success/12 px-2 py-0.5 text-[0.59375rem] font-bold text-success-ink">↑</span>
      </span>
      <span class="flex h-13 items-end gap-1.75">
        <span class="block h-4.5 w-2.5 rounded-[3px] bg-violet-150" />
        <span class="block h-7 w-2.5 rounded-[3px] bg-violet-200" />
        <span class="block h-5.75 w-2.5 rounded-[3px] bg-violet-400" />
        <span class="block h-10 w-2.5 rounded-[3px] bg-violet-500" />
        <span class="block h-13 w-2.5 rounded-[3px] bg-violet-600" />
      </span>
    </div>

    <!-- Branding: circle, rounded square and triangle -->
    <span
      v-else-if="name === 'branding'"
      class="relative block h-24 w-34.5"
    >
      <span class="absolute top-4 left-0 block size-16.5 rounded-full bg-violet-500" />
      <span class="absolute top-0 right-0 block size-15.5 rounded-lg border-2 border-heading" />
      <span class="absolute right-7.5 bottom-0 block size-0 border-r-[19px] border-b-[31px] border-l-[19px] border-r-transparent border-b-violet-200 border-l-transparent" />
    </span>

    <!-- UI/UX: three stacked screens -->
    <span
      v-else-if="name === 'ui-ux-design'"
      class="relative block h-25 w-37.5"
    >
      <span class="absolute top-0 left-0 block h-17 w-26 rounded-[11px] bg-violet-100" />
      <span class="absolute top-4 left-4 block h-17 w-26 rounded-[11px] bg-violet-200" />
      <span class="absolute top-8 left-8 flex h-17 w-26 flex-col gap-1.5 rounded-[11px] border border-line bg-white p-3.25 shadow-[0_12px_28px_rgb(17_31_34/0.09)]">
        <span class="block h-1.5 w-[70%] rounded-[3px] bg-heading" />
        <span class="block h-1 w-[90%] rounded-[2px] bg-skeleton" />
        <span class="mt-auto block h-2.75 w-8.5 rounded-[4px] bg-violet-500" />
      </span>
    </span>

    <!-- Software: a dark code editor -->
    <div
      v-else
      class="flex w-51.5 flex-col gap-2.25 rounded-md bg-ink-900 px-4.75 py-4.25 shadow-[0_14px_32px_rgb(12_23_25/0.24)]"
    >
      <span class="flex items-center gap-2.25">
        <span class="font-display text-sm font-semibold text-violet-400">&lt;/&gt;</span>
        <span class="block h-1 w-13 rounded-[2px] bg-white/16" />
      </span>
      <span class="block h-1.25 w-[84%] rounded-[3px] bg-violet-400/55" />
      <span class="ml-3.5 block h-1.25 w-[62%] rounded-[3px] bg-white/18" />
      <span class="block h-1.25 w-[44%] rounded-[3px] bg-success/75" />
    </div>
  </div>
</template>
