<script setup lang="ts">
/**
 * Dashed empty-state block, same treatment as the customer pages'
 * "No active projects" card on Balance.
 */
defineProps<{
  icon: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
    <span class="mb-4 flex size-14 items-center justify-center rounded-full bg-white/5 text-muted-500">
      <Icon :name="icon" class="size-7" />
    </span>
    <div class="text-base font-bold text-white">
      {{ title }}
    </div>
    <p v-if="subtitle" class="mt-1 max-w-[280px] text-[13px] text-muted-500">
      {{ subtitle }}
    </p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
