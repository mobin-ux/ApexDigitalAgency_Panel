<script setup lang="ts">
/**
 * The design system's PageHeader as the admin console draws it: a 30px/800
 * Yellix title whose last words can take the accent ink, a 15px muted
 * sub-line, and the screen's actions on the right. No eyebrow and no
 * breadcrumb, because the top bar owns location; `eyebrow` is still
 * accepted from older call sites and not rendered.
 */
defineProps<{
  title: string
  accent?: string
  subtitle?: string
  eyebrow?: string
  dense?: boolean
}>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
    <div class="min-w-0">
      <h1 class="font-heading text-fg-heading font-extrabold leading-[1.1] tracking-[-0.02em]" :class="dense ? 'text-[23px]' : 'text-[23px] sm:text-[30px]'">
        {{ title }}<template v-if="accent">
          {{ ' ' }}<span class="text-accent-ink">{{ accent }}</span>
        </template>
      </h1>
      <p v-if="subtitle" class="text-fg-muted mt-2.5 max-w-[42rem] text-[14.5px] leading-normal sm:text-[15px]">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2.5">
      <slot />
    </div>
  </div>
</template>
