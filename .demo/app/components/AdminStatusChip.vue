<script setup lang="ts">
/**
 * Status pill with the shared payment/status-state taxonomy. Free-text
 * statuses (schema strings) are normalized by keyword so PENDING,
 * "Processing", "in progress" etc. all land on the right accent:
 *   green  #22B07D — active / in progress / resolved / approved
 *   amber  #F2C14E — pending / processing / open (needs attention)
 *   blue   #6EA8FE — completed (terminal-good, matches customer orders)
 *   coral  #EC6453 — suspended / cancelled / rejected / failed / urgent
 *   muted           — closed / unknown
 */
const props = defineProps<{
  status: string
  /** Override the keyword mapping when the caller knows better. */
  tone?: 'green' | 'amber' | 'blue' | 'coral' | 'violet' | 'muted'
  label?: string
}>()

const toneClasses = {
  green: 'bg-[#22B07D]/14 text-[#22B07D]',
  amber: 'bg-[#D9A521]/14 text-[#F2C14E]',
  blue: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
  coral: 'bg-[#EC6453]/14 text-[#EC6453]',
  violet: 'bg-primary-500/16 text-primary-400',
  muted: 'bg-white/5 text-muted-400',
} as const

const derived = computed<keyof typeof toneClasses>(() => {
  if (props.tone)
    return props.tone
  const s = props.status.toLowerCase()
  if (/suspend|cancel|reject|fail|urgent|overdue|inactive/.test(s))
    return 'coral'
  if (/complete|paid/.test(s))
    return 'blue'
  if (/active|progress|resolve|approve|success|deposit|verified/.test(s))
    return 'green'
  if (/pending|processing|open|review|wait/.test(s))
    return 'amber'
  return 'muted'
})

const display = computed(() => {
  if (props.label)
    return props.label
  // "IN_PROGRESS" -> "In progress" (sentence case per brand voice).
  const words = props.status.replaceAll('_', ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
})
</script>

<template>
  <span class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold" :class="toneClasses[derived]">
    {{ display }}
  </span>
</template>
