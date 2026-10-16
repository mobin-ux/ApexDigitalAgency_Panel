<script setup lang="ts">
/**
 * A technology logo from the local sprite (`pnpm icons` builds it from the
 * content files). Decorative by default, since the name is always printed
 * beside it; pass `label` where the mark stands alone.
 */
defineProps<{
  icon: string
  label?: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <title v-if="label">{{ label }}</title>
    <use :href="`/icons/tech.svg#${icon}`" />
  </svg>
</template>
