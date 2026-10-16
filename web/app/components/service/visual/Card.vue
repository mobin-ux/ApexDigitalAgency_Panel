<script setup lang="ts">
/** The small card floating at the bottom left of a hero drawing. */
defineProps<{
  title?: string
  /** Right-aligned note in the title row. */
  aside?: string
  /** 10px between rows instead of 11px. */
  dense?: boolean
}>()
</script>

<template>
  <div
    class="absolute bottom-0 -left-10 flex w-65.5 flex-col rounded-xl border border-line bg-white px-4.5 py-4 shadow-[0_28px_60px_rgb(17_31_34/0.16)] motion-safe:animate-drift-c"
    :class="dense ? 'gap-2.5' : 'gap-2.75'"
  >
    <span
      v-if="title"
      class="flex items-baseline gap-2 text-[0.78125rem] text-muted"
    >
      {{ title }}
      <span
        v-if="aside"
        class="ml-auto text-[0.6875rem]"
      >{{ aside }}</span>
    </span>
    <slot />
  </div>
</template>
