<script setup lang="ts">
/**
 * Section label: 3px violet bar + 12px/700 uppercase muted text, 16px above
 * its content. One rule for every section heading below the page header.
 *
 * Renders as an `h2` by default so the page keeps a real heading outline;
 * pass `as="div"` where the section already has its own heading.
 */
withDefaults(defineProps<{
  label?: string
  as?: string
}>(), {
  as: 'h2',
})
</script>

<template>
  <component :is="as" class="flex items-center gap-[11px]">
    <span aria-hidden="true" class="bg-primary-500 h-[15px] w-[3px] shrink-0 rounded-full" />
    <span class="text-muted-500 text-xs font-bold uppercase tracking-[0.06em]">
      <slot>{{ label }}</slot>
    </span>
  </component>
</template>
