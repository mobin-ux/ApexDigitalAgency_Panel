<script setup lang="ts">
/** The green tick that starts an inclusion line. Decorative: the text says what is included. */
withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'sm' })
</script>

<template>
  <span
    class="inline-flex flex-none items-center justify-center rounded-full bg-success text-white"
    :class="size === 'md' ? 'size-4.75 text-[0.625rem]' : 'size-4.5 text-[0.59375rem]'"
    aria-hidden="true"
  >✓</span>
</template>
