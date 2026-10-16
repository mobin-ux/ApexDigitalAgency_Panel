<script setup lang="ts">
/**
 * A filter pill with a result count. `aria-pressed` carries the state, and the
 * count is read out with its noun ("(3 projects)") rather than as a bare digit.
 */
withDefaults(defineProps<{
  pressed: boolean
  count: number
  /** Singular and plural, for the spoken count. */
  noun: readonly [string, string]
  size?: 'sm' | 'md'
}>(), {
  size: 'md',
})
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed"
    class="inline-flex min-h-11 items-center rounded-full border font-semibold transition-colors duration-150"
    :class="[
      size === 'md' ? 'gap-2.25 px-4.5 py-2.75 text-[0.90625rem]' : 'gap-2 px-4 py-2.5 text-sm',
      pressed
        ? 'border-heading bg-heading text-white'
        : 'border-line-strong bg-white text-body hover:border-heading hover:text-heading',
    ]"
  >
    <slot />
    <span
      class="text-xs"
      :class="pressed ? 'text-white/70' : 'text-muted'"
      aria-hidden="true"
    >{{ count }}</span>
    <span class="sr-only">({{ count }} {{ count === 1 ? noun[0] : noun[1] }})</span>
  </button>
</template>
