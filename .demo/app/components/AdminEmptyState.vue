<script setup lang="ts">
/** An empty list, said plainly: what is empty and, in the slot, the way forward. */
defineProps<{
  icon: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="border-line-strong flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center">
    <span class="bg-chip text-fg-muted mb-4 flex size-12 items-center justify-center rounded-xl">
      <Icon :name="icon" class="size-6" />
    </span>
    <div class="text-fg-heading text-[15px] font-semibold">
      {{ title }}
    </div>
    <p v-if="subtitle" class="text-fg-body mt-1 max-w-[340px] text-[13.5px] leading-normal">
      {{ subtitle }}
    </p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
