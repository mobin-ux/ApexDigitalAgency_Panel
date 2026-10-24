<script setup lang="ts">
/**
 * Light / Dark segmented pair — the account menu's and sheet's theme row.
 * `size="lg"` is the sheet's 38px finger target; the popover uses 30px.
 */
const { size = 'sm' } = defineProps<{ size?: 'sm' | 'lg' }>()
const { isDark, setTheme } = useApexTheme()

function seg(on: boolean) {
  return on
    ? 'bg-card text-fg-heading shadow-[0_1px_3px_rgba(17,31,34,.12)]'
    : 'bg-transparent text-fg-body'
}
</script>

<template>
  <span role="group" aria-label="Theme" class="bg-raised border-line-subtle inline-flex border p-[3px]" :class="size === 'lg' ? 'rounded-xl' : 'rounded-[10px]'">
    <button
      v-for="opt in (['light', 'dark'] as const)"
      :key="opt"
      type="button"
      :aria-pressed="opt === 'dark' ? isDark : !isDark"
      class="apex-ring cursor-pointer font-semibold capitalize transition-colors"
      :class="[size === 'lg' ? 'h-[38px] rounded-[9px] px-4 text-[13.5px]' : 'h-[30px] rounded-lg px-[11px] text-[12.5px]', seg(opt === 'dark' ? isDark : !isDark)]"
      @click="setTheme(opt)"
    >
      {{ opt }}
    </button>
  </span>
</template>
