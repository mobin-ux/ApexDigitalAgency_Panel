<script setup lang="ts">
import type { ApexTone } from '~/utils/panel'

/**
 * Status pill for console tables (the design's `chip()`): 24px, 12px/600,
 * the tone's tint and readable ink. Takes a semantic `tone`, or one of the
 * older accent names some screens still pass, or derives a tone from the
 * status word when given neither. `dot` adds the design system's hue dot.
 */
const props = defineProps<{
  status?: string
  tone?: ApexTone | 'green' | 'amber' | 'blue' | 'coral' | 'muted'
  label?: string
  dot?: boolean
}>()

const LEGACY: Record<string, ApexTone> = { green: 'success', amber: 'warning', blue: 'info', coral: 'danger', muted: 'neutral' }

const resolved = computed<ApexTone>(() => {
  if (props.tone) {
    return (LEGACY[props.tone] ?? props.tone) as ApexTone
  }
  const s = (props.status ?? '').toLowerCase()
  if (/suspend|cancel|reject|fail|urgent|overdue|inactive|declin/.test(s)) {
    return 'danger'
  }
  if (/complete|paid|deliver/.test(s)) {
    return 'violet'
  }
  if (/active|progress|resolve|approve|success|verified|publish/.test(s)) {
    return 'success'
  }
  if (/pending|processing|open|review|wait|kickoff/.test(s)) {
    return 'warning'
  }
  return 'neutral'
})

const display = computed(() => {
  if (props.label) {
    return props.label
  }
  // "IN_PROGRESS" -> "In progress" (sentence case per brand voice).
  const words = (props.status ?? '').replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
})

const TONE: Record<ApexTone, string> = {
  success: 'bg-st-success-bg text-st-success-fg',
  warning: 'bg-st-warning-bg text-st-warning-fg',
  danger: 'bg-st-danger-bg text-st-danger-fg',
  info: 'bg-st-info-bg text-st-info-fg',
  violet: 'bg-st-violet-bg text-st-violet-fg',
  neutral: 'bg-st-neutral-bg text-st-neutral-fg',
}
const DOT: Record<ApexTone, string> = {
  success: 'bg-[#22B07D]',
  warning: 'bg-[#D9A521]',
  danger: 'bg-[#EC6453]',
  info: 'bg-[#6EA8FE]',
  violet: 'bg-accent',
  neutral: 'bg-fg-muted',
}
</script>

<template>
  <span class="inline-flex h-6 shrink-0 items-center gap-1.5 justify-self-start whitespace-nowrap rounded-full px-2.5 text-xs font-semibold" :class="TONE[resolved]">
    <span v-if="dot" aria-hidden="true" class="size-1.5 shrink-0 rounded-full" :class="DOT[resolved]" />
    <slot>{{ display }}</slot>
  </span>
</template>
