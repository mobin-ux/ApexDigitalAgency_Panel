<script setup lang="ts">
/**
 * A column heading that sorts its list on the server (ADR-025): the list's
 * `?sort=&dir=` comes from `useAdminSort`, and the endpoint orders the whole
 * table, not just the page on screen. Pressing the current column flips the
 * direction; pressing another starts it at that column's natural direction.
 * The button names the order it will apply, and the arrow shows the one in force.
 */
const props = defineProps<{
  label: string
  column: string
  state: { sort: string, dir: 'asc' | 'desc' }
  /** The direction a first press applies: newest first for dates, A–Z for names. */
  first?: 'asc' | 'desc'
  align?: 'start' | 'end'
}>()
const emit = defineEmits<{ sort: [column: string, dir: 'asc' | 'desc'] }>()

const active = computed(() => props.state.sort === props.column)
const next = computed<'asc' | 'desc'>(() => (active.value ? (props.state.dir === 'asc' ? 'desc' : 'asc') : (props.first ?? 'asc')))
const label = computed(() => `Sort by ${props.label.toLowerCase()}, ${next.value === 'asc' ? 'ascending' : 'descending'}`)
</script>

<template>
  <button
    type="button"
    class="apex-ring hover:text-fg-heading inline-flex items-center gap-1 rounded uppercase"
    :class="[align === 'end' ? 'justify-self-end' : '', active ? 'text-fg-heading' : '']"
    :aria-label="label"
    @click="emit('sort', column, next)"
  >
    {{ props.label }}
    <Icon
      :name="active ? (state.dir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down') : 'lucide:arrow-up-down'"
      class="size-[12px]"
      :class="active ? '' : 'opacity-50'"
      aria-hidden="true"
    />
  </button>
</template>
