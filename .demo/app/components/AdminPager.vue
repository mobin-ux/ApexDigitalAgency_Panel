<script setup lang="ts">
/**
 * Pagination footer for admin list views, driven by the server's
 * `paginated()` envelope (page/pageCount/total).
 */
const props = defineProps<{
  page: number
  pageCount: number
  total: number
  /** Noun for the count line, e.g. "users" -> "142 users". */
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
</script>

<template>
  <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
    <span class="text-[12.5px] text-muted-500 tabular-nums">
      {{ total.toLocaleString('en-GB') }} {{ noun ?? 'results' }} · page {{ page }} of {{ pageCount }}
    </span>
    <div class="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        :disabled="page <= 1"
        class="flex size-11 items-center justify-center rounded-full border border-white/10 bg-muted-800 text-muted-400 transition enabled:hover:border-white/20 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
        @click="go(page - 1)"
      >
        <Icon name="lucide:chevron-left" class="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next page"
        :disabled="page >= pageCount"
        class="flex size-11 items-center justify-center rounded-full border border-white/10 bg-muted-800 text-muted-400 transition enabled:hover:border-white/20 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
        @click="go(page + 1)"
      >
        <Icon name="lucide:chevron-right" class="size-4" />
      </button>
    </div>
  </div>
</template>
