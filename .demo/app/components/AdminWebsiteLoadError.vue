<script setup lang="ts">
/**
 * What a website screen shows when its list could not be loaded (ADR-021,
 * Gate 8): the reason the server gave and a way to try again. Before this
 * a failed fetch rendered the empty state, which told an editor the site
 * had no pages when the panel had simply not answered.
 */
const props = defineProps<{
  error: unknown
  title?: string
}>()
defineEmits<{ retry: [] }>()

const message = computed(() => errorMessage(props.error, 'The panel did not answer. Check the connection and try again.'))
</script>

<template>
  <div class="border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 flex flex-col items-start gap-3 rounded-2xl border p-6 sm:flex-row sm:items-center" role="alert">
    <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EC6453]/14 text-[#EC6453]">
      <Icon name="lucide:circle-alert" class="size-5" aria-hidden="true" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="text-muted-900 text-sm font-semibold dark:text-white">
        {{ title ?? 'Could not load this screen' }}
      </p>
      <p class="text-muted-500 text-[12.5px]">
        {{ message }}
      </p>
    </div>
    <BaseButton size="sm" rounded="lg" variant="muted" @click="$emit('retry')">
      Try again
    </BaseButton>
  </div>
</template>
