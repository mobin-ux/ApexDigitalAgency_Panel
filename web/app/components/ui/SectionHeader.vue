<script setup lang="ts">
/**
 * Eyebrow chip + h2 + optional lead paragraph, the opening of every homepage
 * section. The h2 carries an `id` so its <section> can name itself through
 * aria-labelledby.
 */
withDefaults(defineProps<{
  id: string
  eyebrow: string
  title: string
  align?: 'start' | 'center'
  balance?: boolean
}>(), {
  align: 'start',
  balance: false,
})
</script>

<template>
  <div
    class="flex flex-col gap-4.5"
    :class="align === 'center' ? 'items-center text-center' : 'items-start'"
  >
    <UiEyebrowChip>{{ eyebrow }}</UiEyebrowChip>
    <h2
      :id="id"
      class="font-display text-h2 text-heading"
      :class="balance && 'text-balance'"
    >
      {{ title }}
    </h2>
    <p
      v-if="$slots.default"
      class="max-w-[52ch] text-body-lg text-body"
    >
      <slot />
    </p>
  </div>
</template>
