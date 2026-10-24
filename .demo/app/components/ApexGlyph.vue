<script setup lang="ts">
import type { ApexGlyphKind } from '~/utils/panel'

/**
 * The website's abstract service glyphs — violet squares, rings and bars,
 * never an icon font. One component so the dashboard, New order, My orders and
 * Wallet draw a service the same way; `--glyph-strong` / `--glyph-soft` retint
 * them per theme.
 */
const { kind, size = 24 } = defineProps<{ kind: ApexGlyphKind, size?: number }>()

// Every glyph is drawn on a 24px grid and scaled, so 20–28px all stay crisp
// enough and keep their proportions.
const scale = computed(() => size / 24)
</script>

<template>
  <span aria-hidden="true" class="relative block shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <span class="absolute left-0 top-0 block size-6 origin-top-left" :style="{ transform: `scale(${scale})` }">
      <template v-if="kind === 'web'">
        <span class="border-glyph-strong absolute inset-x-0 top-[2px] block h-5 rounded-[5px] border-2" />
        <span class="bg-glyph-soft absolute left-[5px] top-[7px] block h-[3px] w-[9px] rounded-[2px]" />
        <span class="bg-glyph-strong absolute left-[5px] top-[12px] block h-[5px] w-[14px] rounded-[2px]" />
      </template>
      <template v-else-if="kind === 'seo'">
        <span class="border-glyph-strong absolute left-0 top-0 block size-[17px] rounded-full border-2" />
        <span class="bg-glyph-strong absolute bottom-[2px] right-[1px] block h-[3px] w-[9px] rotate-45 rounded-[2px]" />
      </template>
      <template v-else-if="kind === 'mkt'">
        <span class="absolute inset-x-[3px] bottom-[1px] flex h-[22px] items-end gap-[3px]">
          <span class="bg-glyph-soft block h-[10px] w-[5px] rounded-[2px]" />
          <span class="bg-glyph-strong block h-4 w-[5px] rounded-[2px] opacity-70" />
          <span class="bg-glyph-strong block h-[22px] w-[5px] rounded-[2px]" />
        </span>
      </template>
      <template v-else-if="kind === 'ppc'">
        <span class="border-glyph-soft absolute inset-0 block rounded-full border-2" />
        <span class="bg-glyph-strong absolute left-[7px] top-[7px] block size-[10px] rounded-full" />
      </template>
      <template v-else-if="kind === 'brand'">
        <span class="bg-glyph-soft absolute left-0 top-[3px] block size-4 rounded-full" />
        <span class="border-glyph-strong absolute right-0 top-[3px] block size-4 rounded-[5px] border-2" />
      </template>
      <template v-else-if="kind === 'uiux'">
        <span class="absolute left-[2px] top-[2px] grid grid-cols-[9px_9px] grid-rows-[9px_9px] gap-[3px]">
          <span class="bg-glyph-strong rounded-[2px]" />
          <span class="bg-glyph-soft rounded-[2px]" />
          <span class="bg-glyph-soft rounded-[2px]" />
          <span class="bg-glyph-strong rounded-[2px]" />
        </span>
      </template>
      <template v-else>
        <span class="border-glyph-strong absolute left-0 top-[1px] block size-[15px] rounded-[4px] border-2" />
        <span class="bg-glyph-soft absolute bottom-[2px] right-0 block size-[15px] rounded-[4px]" />
      </template>
    </span>
  </span>
</template>
