<script setup lang="ts">
/**
 * Standard admin page header: Yellix display title, supporting line, and
 * an actions slot on the right — mirrors the customer pages' header
 * treatment so both sides read as one product.
 *
 * `dense` is the Phase 9 form: a 24px title and no eyebrow, which is what
 * the admin design draws now that the sidebar's group label already says
 * where you are. The eyebrow variant stays for the screens that have not
 * been through Phase 9 yet, so this change moves nothing on them.
 */
defineProps<{
  eyebrow?: string
  title: string
  subtitle?: string
  dense?: boolean
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-5">
    <div class="min-w-0">
      <div v-if="eyebrow && !dense" class="text-primary-400 mb-2 text-xs font-bold tracking-[0.04em]">
        {{ eyebrow }}
      </div>
      <h1
        class="font-heading font-extrabold tracking-[-0.02em] text-muted-900 dark:text-white"
        :class="dense ? 'text-2xl leading-[1.15]' : 'text-[30px] leading-[1.05] sm:text-[34px]'"
      >
        {{ title }}
      </h1>
      <p
        v-if="subtitle"
        class="text-muted-600 dark:text-muted-300"
        :class="dense ? 'mt-[7px] text-sm' : 'mt-2 text-[15px] dark:text-muted-400'"
      >
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-3">
      <slot />
    </div>
  </div>
</template>
