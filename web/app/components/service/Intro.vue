<script setup lang="ts">
/**
 * The opening row most service-page sections share: eyebrow and heading on
 * the left, a short paragraph bottom-aligned in a fixed-width column on the
 * right from `lg`, stacked below it.
 */
withDefaults(defineProps<{
  id: string
  eyebrow: string
  title: string
  intro: string
  aside?: 400 | 420 | 440
  tone?: 'light' | 'dark'
  size?: 'lg' | 'md'
}>(), {
  aside: 420,
  tone: 'light',
  size: 'lg',
})

const columns = {
  400: 'lg:grid-cols-[minmax(0,1fr)_400px]',
  420: 'lg:grid-cols-[minmax(0,1fr)_420px]',
  440: 'lg:grid-cols-[minmax(0,1fr)_440px]',
} as const
</script>

<template>
  <div
    class="grid gap-5 lg:items-end lg:gap-16"
    :class="columns[aside]"
  >
    <UiSectionHeader
      :id="id"
      :eyebrow="eyebrow"
      :title="title"
      :tone="tone"
      :size="size"
    />
    <p
      class="text-body-lg lg:mb-1.5"
      :class="tone === 'dark' ? 'text-body-on-dark' : 'text-body'"
    >
      {{ intro }}
    </p>
  </div>
</template>
