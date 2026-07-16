<script setup lang="ts">
/**
 * Headline stat tile for admin pages. Accent vocabulary matches the
 * customer pages' fixed status palette (CLAUDE.md hard rule 1: the four
 * status hexes are the only permitted literals).
 */
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  icon: string
  hint?: string
  accent?: 'violet' | 'green' | 'amber' | 'coral' | 'blue' | 'muted'
}>(), {
  accent: 'violet',
})

const accentClasses: Record<NonNullable<typeof props.accent>, string> = {
  violet: 'bg-primary-500/14 text-primary-400',
  green: 'bg-[#22B07D]/14 text-[#22B07D]',
  amber: 'bg-[#D9A521]/14 text-[#F2C14E]',
  coral: 'bg-[#EC6453]/14 text-[#EC6453]',
  blue: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
  muted: 'bg-white/5 text-muted-400',
}
</script>

<template>
  <div class="flex flex-col rounded-[20px] border border-white/10 bg-muted-800 p-5 transition hover:border-white/15">
    <div class="mb-4 flex items-center justify-between gap-3">
      <span class="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted-500">{{ label }}</span>
      <span class="flex size-9 shrink-0 items-center justify-center rounded-[10px]" :class="accentClasses[accent]">
        <Icon :name="icon" class="size-[18px]" />
      </span>
    </div>
    <div class="font-heading text-[28px] font-extrabold leading-none tracking-[-0.02em] text-white tabular-nums">
      {{ value }}
    </div>
    <div v-if="hint" class="mt-2 text-[12.5px] text-muted-500">
      {{ hint }}
    </div>
  </div>
</template>
