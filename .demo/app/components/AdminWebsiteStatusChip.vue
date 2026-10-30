<script setup lang="ts">
import type { DisplayStatus } from '~~/shared/cms'
import { DISPLAY_STATUS_LABEL } from '~~/shared/cms'

/**
 * One chip per display status (shared/cms/workflow.ts), on the panel's
 * status accents: green for live, amber for anything waiting on a person,
 * blue for a schedule, muted for a plain draft or an archive (status
 * tokens, so each chip is legible in both themes). A failed
 * scheduled publish keeps its state and adds the coral error beside it.
 */
const props = defineProps<{ state: DisplayStatus, error?: string | null }>()

const TONE: Record<DisplayStatus, string> = {
  draft: 'bg-st-neutral-bg text-st-neutral-fg',
  in_review: 'bg-st-warning-bg text-st-warning-fg',
  approved: 'bg-st-warning-bg text-st-warning-fg',
  scheduled: 'bg-st-info-bg text-st-info-fg',
  published: 'bg-st-success-bg text-st-success-fg',
  published_changes: 'bg-st-success-bg text-st-success-fg',
  archived: 'bg-st-neutral-bg text-st-neutral-fg',
}

const label = computed(() => DISPLAY_STATUS_LABEL[props.state])
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1.5">
    <span class="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold" :class="TONE[state]">{{ label }}</span>
    <span v-if="error" class="bg-st-danger-bg text-st-danger-fg inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold" :title="error">Publish failed</span>
  </span>
</template>
