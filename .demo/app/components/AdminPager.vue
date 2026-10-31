<script setup lang="ts">
/** "62 projects · page 1 of 3" with previous/next, for lists longer than a page. */
const props = defineProps<{
  page: number
  pageCount: number
  total: number
  noun?: string
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

function go(page: number) {
  if (page >= 1 && page <= props.pageCount && page !== props.page) {
    emit('update:page', page)
  }
}

const BTN = 'apex-ring border-line-subtle text-fg-heading flex size-11 items-center justify-center rounded-full border transition enabled:hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 sm:size-8'
</script>

<template>
  <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
    <span class="text-fg-muted text-[12.5px] tabular-nums">
      {{ total.toLocaleString('en-GB') }} {{ noun ?? 'results' }} · page {{ page }} of {{ pageCount }}
    </span>
    <div class="flex items-center gap-2">
      <button type="button" aria-label="Previous page" :disabled="page <= 1" :class="BTN" @click="go(page - 1)">
        <Icon name="lucide:chevron-left" class="size-4" />
      </button>
      <button type="button" aria-label="Next page" :disabled="page >= pageCount" :class="BTN" @click="go(page + 1)">
        <Icon name="lucide:chevron-right" class="size-4" />
      </button>
    </div>
  </div>
</template>
