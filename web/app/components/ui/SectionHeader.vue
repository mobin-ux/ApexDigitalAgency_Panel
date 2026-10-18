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
  tone?: 'light' | 'dark'
  /** `md` is the designs' 44px secondary section heading (48px is `lg`). */
  size?: 'lg' | 'md'
}>(), {
  align: 'start',
  balance: false,
  tone: 'light',
  size: 'lg',
})
</script>

<template>
  <div
    class="flex flex-col gap-4.5"
    :class="align === 'center' ? 'items-center text-center' : 'items-start'"
  >
    <UiEyebrowChip :tone="tone">
      {{ eyebrow }}
    </UiEyebrowChip>
    <h2
      :id="id"
      class="font-display text-h2"
      :class="[tone === 'dark' ? 'text-white' : 'text-heading', balance && 'text-balance', size === 'md' && 'lg:text-[2.75rem]']"
    >
      {{ title }}
    </h2>
    <p
      v-if="$slots.default"
      class="max-w-[52ch] text-body-lg"
      :class="tone === 'dark' ? 'text-body-on-dark' : 'text-body'"
    >
      <slot />
    </p>
  </div>
</template>
