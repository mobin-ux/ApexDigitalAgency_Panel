<script setup lang="ts">
import type { StaffRole } from '~~/shared/permissions'
import { ROLES } from '~~/shared/permissions'

/**
 * A staff role, always rendered the same way — team table, invite panel,
 * role dialogs and audit log all use this, so one role cannot be
 * described two different ways in two places. Tones live in
 * `utils/roleTone.ts`.
 */
const { role, size = 'md' } = defineProps<{
  role: StaffRole
  size?: 'sm' | 'md'
}>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-extrabold uppercase tracking-[0.04em]"
    :class="[ROLE_CHIP[role], size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-[5px] text-[10.5px]']"
  >
    {{ ROLES[role].label }}
  </span>
</template>
