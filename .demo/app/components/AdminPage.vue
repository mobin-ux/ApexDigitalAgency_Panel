<script setup lang="ts">
/**
 * The admin console's page column (`Admin Console.dc.html`): 1180px wide,
 * 28/32/40px of padding at desktop, a 24px rhythm between sections. The
 * gutter tightens to 16px on a phone, the rhythm to 20px.
 */
const { width = 'md', gap = 'lg' } = defineProps<{
  width?: 'md' | 'wide'
  gap?: 'md' | 'lg'
}>()
</script>

<template>
  <div
    class="mx-auto flex w-full flex-col px-4 pb-10 pt-5 sm:px-8 sm:pt-7"
    :class="[width === 'wide' ? 'max-w-[1360px]' : 'max-w-[1180px]', gap === 'lg' ? 'gap-5 sm:gap-6' : 'gap-5']"
  >
    <slot />
  </div>
</template>
