<script setup lang="ts">
/**
 * The admin console's button (`Admin Console.dc.html` `btn()`): a 38px pill,
 * 13.5px/600. Primary is violet with its glow, light is a strong hairline,
 * danger is coral. `lg` is the 42px pair in the confirmation dialog and `sm`
 * the 32–34px buttons inside rows and checklists.
 *
 * Renders a NuxtLink when given `to`, so a navigation is a link and not a
 * button with a click handler.
 */
const { variant = 'light', size = 'md', to, disabled = false, type = 'button' } = defineProps<{
  variant?: 'primary' | 'light' | 'danger' | 'danger-text'
  size?: 'sm' | 'md' | 'lg'
  to?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}>()

const NuxtLink = resolveComponent('NuxtLink')

const VARIANT = {
  'primary': 'bg-accent hover:bg-accent-hover text-white shadow-[0_10px_24px_rgba(125,83,242,.28)] border-0',
  'light': 'border border-line-strong text-fg-heading hover:bg-hover bg-transparent',
  'danger': 'bg-danger-strong text-white border-0 hover:brightness-110',
  'danger-text': 'border border-line-strong text-st-danger-fg hover:bg-hover bg-transparent',
} as const

const SIZE = {
  sm: 'h-[34px] px-3.5 text-[13px]',
  md: 'h-[38px] px-[15px] text-[13.5px]',
  lg: 'h-[42px] px-[18px] text-sm',
} as const
</script>

<template>
  <component
    :is="to && !disabled ? NuxtLink : 'button'"
    :to="to && !disabled ? to : undefined"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled"
    :aria-disabled="disabled || undefined"
    class="apex-ring inline-flex shrink-0 items-center justify-center gap-[7px] whitespace-nowrap rounded-full font-semibold transition-colors"
    :class="[VARIANT[variant], SIZE[size], disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer']"
  >
    <slot />
  </component>
</template>
