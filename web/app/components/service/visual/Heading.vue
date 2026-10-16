<script setup lang="ts">
/**
 * The row at the top of a hero drawing: a small label over a title, and on
 * the right either a violet `chip` or whatever the slot supplies.
 */
defineProps<{
  label?: string
  title: string
  chip?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2.5">
    <span class="flex flex-col gap-0.5">
      <span
        v-if="label"
        class="text-[0.65625rem] text-muted"
      >{{ label }}</span>
      <span class="font-display text-sm font-bold tracking-[-0.01em] text-heading">{{ title }}</span>
    </span>
    <span
      v-if="chip"
      class="ml-auto rounded-full bg-violet-50 px-2.25 py-0.75 text-[0.65625rem] font-bold text-violet-600"
    >{{ chip }}</span>
    <span
      v-else
      class="ml-auto"
    >
      <slot />
    </span>
  </div>
</template>
