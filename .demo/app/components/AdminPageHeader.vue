<script setup lang="ts">
/**
 * Standard admin page header: uppercase eyebrow, Yellix display title,
 * supporting line, and an actions slot on the right — mirrors the
 * customer pages' header treatment so both sides read as one product.
 */
defineProps<{
  eyebrow: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-5">
    <div>
      <div class="mb-2 text-xs font-bold tracking-[0.04em] text-primary-400">
        {{ eyebrow }}
      </div>
      <h1 class="font-heading text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-[34px]">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="mt-2 text-[15px] text-muted-400">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-3">
      <slot />
    </div>
  </div>
</template>
