<script setup lang="ts">
/**
 * The one page-header pattern. Nothing else goes above the fold.
 *
 *   [h1 30px/800 Yellix, accent word in violet]        [primary action, right]
 *   [15px muted sub-line, one line, max-w-2xl]
 *                              ↓ 32px
 *
 * Titles stay two-tone (`Wallet & credit`, `My orders`) — that is recognisably
 * the product — but at one size on every page; they used to range 28–34px.
 * Split the accent word off via the `accent` prop or the `title` slot.
 *
 * Eyebrow labels are deliberately not supported: the two that existed
 * ("👋 WELCOME BACK", "NEW ORDER") repeated the headline and the breadcrumb
 * word for word, and the emoji broke the rule that 👋/🔥 are marketing
 * accents, never product UI.
 */
defineProps<{
  /** Leading, full-contrast part of the headline. */
  title?: string
  /** Trailing part, rendered in the brand accent. */
  accent?: string
  /** One line of supporting copy. */
  subtitle?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
    <div class="min-w-0">
      <!-- 23px on a phone, 30px from `md` up: the desktop size wraps a
           two-tone headline onto three lines at 393px. -->
      <h1 class="font-heading text-muted-900 text-[23px] font-extrabold leading-[1.1] tracking-[-0.02em] md:text-3xl dark:text-white">
        <!--
          The separator is `{{ ' ' }}`, not a literal space: Vue's `condense`
          whitespace handling strips whitespace-only text between elements when
          it spans a newline, which silently rendered "Myorders". An
          interpolated space is a real node and survives — and unlike `&nbsp;`
          it still lets the headline wrap between the two words.
        -->
        <slot name="title">
          {{ title }}{{ ' ' }}<span v-if="accent" class="text-primary-600 dark:text-primary-400">{{ accent }}</span>
        </slot>
      </h1>
      <p v-if="subtitle || $slots.subtitle" class="text-muted-500 mt-2.5 max-w-2xl text-[14.5px] leading-[1.5] md:text-[15px]">
        <slot name="subtitle">
          {{ subtitle }}
        </slot>
      </p>
    </div>
    <!--
      Full width below `sm` so an action that opts into `w-full` actually
      fills the row once the header has wrapped; auto-width from `sm` up.
    -->
    <div v-if="$slots.actions" class="flex w-full shrink-0 flex-wrap items-center gap-2.5 sm:w-auto">
      <slot name="actions" />
    </div>
  </div>
</template>
