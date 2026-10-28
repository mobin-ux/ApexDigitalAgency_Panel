<script setup lang="ts">
import type { DisplayStatus } from '~~/shared/cms'
import { DISPLAY_STATUS_LABEL } from '~~/shared/cms'

/**
 * One chip per display status (shared/cms/workflow.ts), on the panel's
 * status accents: green for live, amber for anything waiting on a person,
 * blue for a schedule, muted for a plain draft or an archive. A failed
 * scheduled publish keeps its state and adds the coral error beside it.
 */
const props = defineProps<{ state: DisplayStatus, error?: string | null }>()

const TONE: Record<DisplayStatus, string> = {
  draft: 'bg-muted-200 text-muted-600 dark:bg-white/5 dark:text-muted-400',
  in_review: 'bg-[#D9A521]/14 text-[#F2C14E]',
  approved: 'bg-[#D9A521]/14 text-[#F2C14E]',
  scheduled: 'bg-[#6EA8FE]/14 text-[#6EA8FE]',
  published: 'bg-[#22B07D]/14 text-[#22B07D]',
  published_changes: 'bg-[#22B07D]/14 text-[#22B07D]',
  archived: 'bg-muted-200 text-muted-600 dark:bg-white/5 dark:text-muted-400',
}

const label = computed(() => DISPLAY_STATUS_LABEL[props.state])
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1.5">
    <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold" :class="TONE[state]">{{ label }}</span>
    <span v-if="error" class="inline-flex items-center rounded-full bg-[#EC6453]/14 px-2.5 py-1 text-[11.5px] font-bold text-[#EC6453]" :title="error">Publish failed</span>
  </span>
</template>
