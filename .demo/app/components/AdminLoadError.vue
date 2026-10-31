<script setup lang="ts">
/**
 * What an admin screen shows when its data could not be loaded: the reason
 * the server gave and a way to try again. A failed fetch must never render
 * the empty state, which would tell staff there is nothing there when the
 * panel had simply not answered.
 */
const props = defineProps<{
  error: unknown
  title?: string
}>()
defineEmits<{ retry: [] }>()

const message = computed(() => errorMessage(props.error, 'The panel did not answer. Check the connection and try again.'))
</script>

<template>
  <div class="bg-card border-line-subtle flex flex-col items-start gap-3 rounded-2xl border p-6 sm:flex-row sm:items-center" role="alert">
    <span class="bg-st-danger-bg text-st-danger-fg flex size-10 shrink-0 items-center justify-center rounded-xl">
      <Icon name="lucide:circle-alert" class="size-5" aria-hidden="true" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="text-fg-heading text-sm font-semibold">
        {{ title ?? 'Could not load this screen' }}
      </p>
      <p class="text-fg-muted text-[12.5px]">
        {{ message }}
      </p>
    </div>
    <AdminButton size="sm" @click="$emit('retry')">
      Try again
    </AdminButton>
  </div>
</template>
