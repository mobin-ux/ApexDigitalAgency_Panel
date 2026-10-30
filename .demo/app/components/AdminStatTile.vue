<script setup lang="ts">
/**
 * The Overview's count tile (`Admin Console.dc.html`): a 12.5px muted label
 * held to two lines, a 34px Yellix figure and the call to action in accent
 * ink. Every tile counts records a screen lists, so a tile with `to` is a
 * link to that screen and lifts on hover. `icon` and `accent` are still
 * accepted from older call sites; the design's tile carries neither.
 */
const { cta = 'Open', to } = defineProps<{
  label: string
  value: string | number
  icon?: string
  hint?: string
  cta?: string
  accent?: string
  to?: string
}>()

const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="bg-card border-line-subtle flex min-w-0 flex-col gap-1.5 rounded-2xl border px-[18px] pb-4 pt-[18px] transition-[transform,border-color] duration-200"
    :class="to && 'apex-ring hover:border-line-strong motion-safe:hover:-translate-y-0.5'"
  >
    <span class="text-fg-muted min-h-[34px] text-[12.5px] leading-[1.35]">{{ label }}</span>
    <span class="font-heading text-fg-heading text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{{ value }}</span>
    <span v-if="hint" class="text-fg-muted text-[12.5px]">{{ hint }}</span>
    <span v-if="to" class="text-accent-ink mt-1 text-[12.5px] font-semibold">{{ cta }} →</span>
  </component>
</template>
