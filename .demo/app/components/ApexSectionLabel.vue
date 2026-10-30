<script setup lang="ts">
/**
 * Section label: a 3px violet bar and 12px/700 uppercase muted text. The
 * design system's SectionLabel, one rule for every panel and console
 * section head, on the theme tokens so it reads in both themes.
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
    <span aria-hidden="true" class="bg-accent h-[15px] w-[3px] shrink-0 rounded-full" />
    <span class="text-fg-muted text-xs font-bold uppercase tracking-[0.06em]">
      <slot>{{ label }}</slot>
    </span>
  </component>
</template>
