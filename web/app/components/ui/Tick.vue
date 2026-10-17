<script setup lang="ts">
/** The green tick that starts an inclusion line. Decorative: the text says what is included. */
withDefaults(defineProps<{ size?: 'xs' | 'sm' | 'md' | 'lg' }>(), { size: 'sm' })

const sizes = {
  xs: 'size-4 text-[0.53125rem]',
  sm: 'size-4.5 text-[0.59375rem]',
  md: 'size-4.75 text-[0.625rem]',
  lg: 'size-5 text-[0.625rem]',
} as const
</script>

<template>
  <span
    class="inline-flex flex-none items-center justify-center rounded-full bg-success text-white"
    :class="sizes[size]"
    aria-hidden="true"
  >✓</span>
</template>
