<script setup lang="ts">
/** Small pill above a heading. `emoji` is the one place Apex uses an emoji. */
withDefaults(defineProps<{
  tone?: 'light' | 'dark'
  emoji?: string
}>(), {
  tone: 'light',
})
</script>

<template>
  <span
    class="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-[0.8125rem] font-semibold"
    :class="tone === 'light'
      ? 'border-line bg-white text-heading shadow-chip'
      : 'border-white/12 bg-white/8 text-white'"
  >
    <span v-if="emoji" aria-hidden="true">{{ emoji }}</span>
    <slot />
  </span>
</template>
