<script setup lang="ts">
import type { ApexTone } from '~/utils/panel'

/**
 * Tinted status pill with a hue dot (design system `StatusChip`).
 *
 * On light surfaces amber, coral and blue fail AA as text, so their chips use
 * ink text and the dot carries the hue; on dark the text takes the hue too.
 * Both are the `--status-*` tokens, so this component never names a theme.
 */
const { tone = 'neutral', dot = true } = defineProps<{ tone?: ApexTone, dot?: boolean }>()

const TONES: Record<ApexTone, { chip: string, dot: string }> = {
  success: { chip: 'bg-st-success-bg text-st-success-fg', dot: 'bg-[#22B07D]' },
  warning: { chip: 'bg-st-warning-bg text-st-warning-fg', dot: 'bg-[#D9A521]' },
  danger: { chip: 'bg-st-danger-bg text-st-danger-fg', dot: 'bg-[#EC6453]' },
  info: { chip: 'bg-st-info-bg text-st-info-fg', dot: 'bg-[#6EA8FE]' },
  violet: { chip: 'bg-st-violet-bg text-st-violet-fg', dot: 'bg-accent' },
  neutral: { chip: 'bg-st-neutral-bg text-st-neutral-fg', dot: 'bg-fg-muted' },
}
</script>

<template>
  <span class="inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold" :class="TONES[tone].chip">
    <span v-if="dot" aria-hidden="true" class="size-1.5 shrink-0 rounded-full" :class="TONES[tone].dot" />
    <slot />
  </span>
</template>
