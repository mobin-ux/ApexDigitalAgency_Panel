<script setup lang="ts">
/**
 * The one button/link-button primitive. Renders the right element for what it
 * does: a router link for internal URLs, an anchor for external ones and a
 * <button> otherwise, so call sites never choose the tag by hand.
 */
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'light' | 'ink'
  size?: 'sm' | 'md' | 'lg'
  shape?: 'rounded' | 'pill'
  to?: string
  href?: string
  type?: 'button' | 'submit'
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  shape: 'rounded',
  type: 'button',
  block: false,
})

const tag = computed(() => {
  if (props.to) {
    return resolveComponent('NuxtLink')
  }
  return props.href ? 'a' : 'button'
})

const linkProps = computed(() => {
  if (props.to) {
    return { to: props.to }
  }
  if (props.href) {
    return { href: props.href }
  }
  return { type: props.type }
})

const variants = {
  primary: 'border-violet-500 bg-violet-500 text-white shadow-button hover:bg-violet-600 hover:border-violet-600',
  light: 'border-line-strong bg-white text-heading shadow-chip hover:bg-subtle',
  ink: 'border-ink bg-ink text-white hover:bg-ink-800',
} as const

const sizes = {
  sm: 'min-h-10 px-4.5 py-2.5 text-sm',
  md: 'min-h-12 px-6 py-3 text-[0.9375rem]',
  lg: 'min-h-14 px-8 py-4 text-base',
} as const

const shapes = {
  rounded: { sm: 'rounded-md', md: 'rounded-md', lg: 'rounded-lg' },
  pill: { sm: 'rounded-full', md: 'rounded-full', lg: 'rounded-full' },
} as const
</script>

<template>
  <component
    :is="tag"
    v-bind="linkProps"
    class="inline-flex items-center justify-center gap-2 border font-semibold whitespace-nowrap transition duration-150 ease-out-soft motion-safe:hover:-translate-y-px"
    :class="[variants[variant], sizes[size], shapes[shape][size], block && 'w-full']"
  >
    <slot />
  </component>
</template>
