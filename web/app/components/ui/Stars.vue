<script setup lang="ts">
/**
 * Five filled stars. Always decorative: wherever a rating is shown, the score
 * is also written out as text, so the stars are hidden from assistive tech.
 * Colour comes from the parent (`text-amber-500`).
 */
const props = withDefaults(defineProps<{
  /** Width of one star, in px. */
  size?: number
  /** Space between stars, in px. */
  gap?: number
}>(), {
  size: 10,
  gap: 1,
})

const width = computed(() => props.size * 5 + props.gap * 4)
const scale = computed(() => props.size / 10)
</script>

<template>
  <svg
    :width="width"
    :height="size"
    :viewBox="`0 0 ${width} ${size}`"
    class="block flex-none"
    aria-hidden="true"
  >
    <path
      v-for="n in 5"
      :key="n"
      :transform="`translate(${(n - 1) * (size + gap)} 0) scale(${scale})`"
      d="M5 0.5 6.3 3.6 9.6 3.9 7.1 6.1 7.8 9.4 5 7.7 2.2 9.4 2.9 6.1 0.4 3.9 3.7 3.6Z"
      fill="currentColor"
    />
  </svg>
</template>
