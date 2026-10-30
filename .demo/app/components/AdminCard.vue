<script setup lang="ts">
/**
 * A console surface: the card plane with a hairline and a 16px radius.
 * `label` renders the section label row (3px violet bar, 12px/700 caps)
 * with an optional `meta` on the right and an `#aside` slot after it.
 * `padded` is the design's 20/22px card; unpadded cards hold full-width rows.
 */
const { as = 'section', padded = false } = defineProps<{
  as?: string
  label?: string
  meta?: string
  padded?: boolean
}>()
</script>

<template>
  <component :is="as" class="bg-card border-line-subtle min-w-0 rounded-2xl border" :class="padded && 'flex flex-col gap-3.5 px-[18px] py-5 sm:px-[22px]'">
    <div v-if="label" class="flex flex-wrap items-center gap-3" :class="!padded && 'px-[18px] pb-3.5 pt-5 sm:px-[22px]'">
      <ApexSectionLabel>{{ label }}</ApexSectionLabel>
      <span class="flex-1" />
      <span v-if="meta" class="text-fg-muted text-[12.5px]">{{ meta }}</span>
      <slot name="aside" />
    </div>
    <slot />
  </component>
</template>
