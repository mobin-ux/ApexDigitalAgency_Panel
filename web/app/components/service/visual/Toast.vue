<script setup lang="ts">
/** The notification that fades in and out beside a hero drawing. The caller positions it. */
withDefaults(defineProps<{
  title: string
  sub: string
  icon?: string
  tone?: 'success' | 'violet'
}>(), {
  icon: '✓',
  tone: 'success',
})
</script>

<template>
  <div class="absolute flex items-center gap-2.75 rounded-lg border border-line bg-white px-4 py-3 shadow-toast motion-safe:animate-toast">
    <span
      class="inline-flex size-6.5 flex-none items-center justify-center rounded-full text-xs"
      :class="tone === 'violet' ? 'bg-violet-50 text-violet-600' : 'bg-success-50 text-success-ink'"
    >{{ icon }}</span>
    <span class="flex flex-col gap-0.5">
      <span class="font-display text-[0.84375rem] font-semibold tracking-[-0.01em] text-heading">{{ title }}</span>
      <span class="text-[0.71875rem] text-muted">{{ sub }}</span>
    </span>
  </div>
</template>
