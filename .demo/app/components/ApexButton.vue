<script setup lang="ts">
/**
 * Panel v2 button (design system `Button`: primary / white / soft / light;
 * sm 40 · md 46). A link when given `to`, a button otherwise, so a navigation
 * is never a `<button>` with a click handler and vice versa.
 *
 * `BaseButton` is still the panel's button for admin screens; this one exists
 * because the v2 pages draw a 14px-radius, violet-glow control that Shuriken's
 * radius scale (no 14px step) cannot express without `!` on every use.
 */
const {
  to,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  block = false,
} = defineProps<{
  to?: string
  variant?: 'primary' | 'white' | 'soft' | 'light'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  disabled?: boolean
  block?: boolean
}>()

const VARIANTS = {
  primary: 'bg-accent text-white shadow-violet hover:bg-accent-hover hover:-translate-y-px',
  white: 'bg-white text-[#101828] hover:-translate-y-px',
  soft: 'bg-accent-tint text-accent-ink hover:bg-accent hover:text-white',
  light: 'bg-card text-fg-heading border border-line-rule hover:border-line-strong',
}

const classes = computed(() => [
  'apex-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,transform,border-color] duration-200 active:scale-[.985] motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  size === 'sm' ? 'h-10 rounded-xl px-4 text-sm' : 'h-[46px] rounded-[14px] px-[22px] text-[15px]',
  VARIANTS[variant],
  block ? 'w-full' : '',
  disabled ? 'pointer-events-none opacity-50 shadow-none' : '',
])
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled" :aria-disabled="disabled || undefined" :class="classes">
    <slot />
  </button>
</template>
